import type { Prisma } from "@prisma/client";
import argon2 from "argon2";
import type { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { withIdempotency } from "@/lib/idempotency";
import { userCreateSchema, userUpdateSchema } from "./schema";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function firstError(error: ZodError): string {
  return error.errors[0]?.message ?? "Invalid input";
}

function isPrismaUniqueViolation(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    (e as { code?: string }).code === "P2002"
  );
}

function errorMessage(e: unknown, fallback: string): string {
  return e instanceof Error ? e.message : fallback;
}

async function assertCallerIsOwner(callerUserId: string): Promise<string | null> {
  const caller = await prisma.user.findUnique({
    where: { id: callerUserId },
    select: { role: true, active: true },
  });
  if (!caller || !caller.active) return "Caller is not authenticated";
  if (caller.role !== "OWNER") return "Only OWNER can manage users";
  return null;
}

export async function createUserOp(
  callerUserId: string,
  idempotencyKey: string,
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const authError = await assertCallerIsOwner(callerUserId);
  if (authError) return { ok: false, error: authError };

  const parsed = userCreateSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const input = parsed.data;

  try {
    const pinHash = await argon2.hash(input.pin);

    const result = await withIdempotency(idempotencyKey, "users.create", () =>
      prisma.$transaction(async (tx) => {
        // Validate channel ids before creating anything else.
        if (input.role === "SELLER" && input.allowedChannelIds.length > 0) {
          const existing = await tx.channel.findMany({
            where: { id: { in: input.allowedChannelIds } },
            select: { id: true },
          });
          if (existing.length !== input.allowedChannelIds.length) {
            throw new Error("One or more allowed channels do not exist");
          }
        }

        const user = await tx.user.create({
          data: {
            name: input.name,
            phone: input.phone,
            pinHash,
            role: input.role,
          },
        });

        if (input.role === "SELLER" && input.allowedChannelIds.length > 0) {
          await tx.userChannel.createMany({
            data: input.allowedChannelIds.map((channelId) => ({
              userId: user.id,
              channelId,
            })),
          });
        }

        await tx.auditLog.create({
          data: {
            tableName: "users",
            recordId: user.id,
            action: "INSERT",
            changes: {
              name: input.name,
              phone: input.phone,
              role: input.role,
              allowedChannelIds: input.allowedChannelIds,
            } as Prisma.InputJsonValue,
            userId: callerUserId,
          },
        });

        return { id: user.id };
      }),
    );

    return { ok: true, data: result };
  } catch (e: unknown) {
    if (isPrismaUniqueViolation(e)) {
      return { ok: false, error: "Phone already in use" };
    }
    return { ok: false, error: errorMessage(e, "Failed to create user") };
  }
}

export async function updateUserOp(
  callerUserId: string,
  idempotencyKey: string,
  id: string,
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const authError = await assertCallerIsOwner(callerUserId);
  if (authError) return { ok: false, error: authError };

  const parsed = userUpdateSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const input = parsed.data;

  try {
    const newPinHash = input.resetPin
      ? await argon2.hash(input.resetPin)
      : undefined;

    const result = await withIdempotency(
      idempotencyKey,
      `users.update.${id}`,
      () =>
        prisma.$transaction(async (tx) => {
          const before = await tx.user.findUniqueOrThrow({
            where: { id },
            include: { channels: true },
          });

          // Don't let the last active OWNER be demoted or deactivated.
          if (before.role === "OWNER" && before.active) {
            const otherActiveOwners = await tx.user.count({
              where: {
                role: "OWNER",
                active: true,
                NOT: { id: before.id },
              },
            });
            if (otherActiveOwners === 0) {
              if (input.role !== "OWNER" || !input.active) {
                throw new Error(
                  "Cannot demote or deactivate the last active OWNER",
                );
              }
            }
          }

          if (input.role === "SELLER" && input.allowedChannelIds.length > 0) {
            const existing = await tx.channel.findMany({
              where: { id: { in: input.allowedChannelIds } },
              select: { id: true },
            });
            if (existing.length !== input.allowedChannelIds.length) {
              throw new Error("One or more allowed channels do not exist");
            }
          }

          const updated = await tx.user.update({
            where: { id },
            data: {
              name: input.name,
              role: input.role,
              active: input.active,
              ...(newPinHash ? { pinHash: newPinHash } : {}),
            },
          });

          // Reconcile UserChannel rows. OWNERs don't keep any
          // UserChannel rows (they're always-allowed); SELLERs have
          // the rows that match input.allowedChannelIds.
          await tx.userChannel.deleteMany({ where: { userId: id } });
          if (
            input.role === "SELLER" &&
            input.allowedChannelIds.length > 0
          ) {
            await tx.userChannel.createMany({
              data: input.allowedChannelIds.map((channelId) => ({
                userId: id,
                channelId,
              })),
            });
          }

          await tx.auditLog.create({
            data: {
              tableName: "users",
              recordId: id,
              action: "UPDATE",
              changes: {
                before: {
                  name: before.name,
                  role: before.role,
                  active: before.active,
                  channelIds: before.channels.map((c) => c.channelId),
                },
                after: {
                  name: updated.name,
                  role: updated.role,
                  active: updated.active,
                  channelIds: input.allowedChannelIds,
                  pinReset: !!newPinHash,
                },
              } as unknown as Prisma.InputJsonValue,
              userId: callerUserId,
            },
          });

          return { id: updated.id };
        }),
    );

    return { ok: true, data: result };
  } catch (e: unknown) {
    return { ok: false, error: errorMessage(e, "Failed to update user") };
  }
}
