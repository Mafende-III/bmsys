import type { Prisma } from "@prisma/client";
import type { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { withIdempotency } from "@/lib/idempotency";
import {
  channelCreateSchema,
  channelDeactivateSchema,
  channelUpdateSchema,
} from "./schema";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

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

export async function createChannelOp(
  userId: string,
  idempotencyKey: string,
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = channelCreateSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const input = parsed.data;

  try {
    const result = await withIdempotency(idempotencyKey, "channels.create", () =>
      prisma.$transaction(async (tx) => {
        const created = await tx.channel.create({ data: input });
        await tx.auditLog.create({
          data: {
            tableName: "channels",
            recordId: created.id,
            action: "INSERT",
            changes: input as Prisma.InputJsonValue,
            userId,
          },
        });
        return { id: created.id };
      }),
    );
    return { ok: true, data: result };
  } catch (e: unknown) {
    if (isPrismaUniqueViolation(e)) {
      return { ok: false, error: "Slug already in use" };
    }
    return { ok: false, error: errorMessage(e, "Failed to create channel") };
  }
}

export async function updateChannelOp(
  userId: string,
  idempotencyKey: string,
  id: string,
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = channelUpdateSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const input = parsed.data;

  try {
    const result = await withIdempotency(
      idempotencyKey,
      `channels.update.${id}`,
      () =>
        prisma.$transaction(async (tx) => {
          const before = await tx.channel.findUniqueOrThrow({ where: { id } });
          const updated = await tx.channel.update({ where: { id }, data: input });
          await tx.auditLog.create({
            data: {
              tableName: "channels",
              recordId: id,
              action: "UPDATE",
              changes: {
                before,
                after: updated,
              } as unknown as Prisma.InputJsonValue,
              userId,
            },
          });
          return { id: updated.id };
        }),
    );
    return { ok: true, data: result };
  } catch (e: unknown) {
    return { ok: false, error: errorMessage(e, "Failed to update channel") };
  }
}

/**
 * Soft-delete (active=false). Refuses if any Sale exists on this
 * channel in the last 30 days. The guard is re-checked inside the
 * transaction so a concurrent sale cannot slip past.
 */
export async function deactivateChannelOp(
  userId: string,
  idempotencyKey: string,
  id: string,
): Promise<ActionResult<{ id: string }>> {
  const parsed = channelDeactivateSchema.safeParse({ id });
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  try {
    const result = await withIdempotency(
      idempotencyKey,
      `channels.deactivate.${id}`,
      () =>
        prisma.$transaction(async (tx) => {
          const channel = await tx.channel.findUniqueOrThrow({ where: { id } });

          if (!channel.active) {
            return { id }; // already deactivated; idempotent no-op
          }

          const since = new Date(Date.now() - THIRTY_DAYS_MS);
          const recentSales = await tx.sale.count({
            where: { channelId: id, date: { gte: since } },
          });
          if (recentSales > 0) {
            throw new Error(
              `Cannot deactivate: ${recentSales} sale(s) on this channel in the last 30 days`,
            );
          }

          const deactivated = await tx.channel.update({
            where: { id },
            data: { active: false },
          });
          await tx.auditLog.create({
            data: {
              tableName: "channels",
              recordId: id,
              action: "UPDATE",
              changes: {
                deactivated: true,
                before: channel,
              } as unknown as Prisma.InputJsonValue,
              userId,
            },
          });
          return { id: deactivated.id };
        }),
    );
    return { ok: true, data: result };
  } catch (e: unknown) {
    return { ok: false, error: errorMessage(e, "Failed to deactivate channel") };
  }
}

export async function reactivateChannelOp(
  userId: string,
  idempotencyKey: string,
  id: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const result = await withIdempotency(
      idempotencyKey,
      `channels.reactivate.${id}`,
      () =>
        prisma.$transaction(async (tx) => {
          const channel = await tx.channel.findUniqueOrThrow({ where: { id } });
          if (channel.active) return { id };
          const reactivated = await tx.channel.update({
            where: { id },
            data: { active: true },
          });
          await tx.auditLog.create({
            data: {
              tableName: "channels",
              recordId: id,
              action: "UPDATE",
              changes: {
                reactivated: true,
                before: channel,
              } as unknown as Prisma.InputJsonValue,
              userId,
            },
          });
          return { id: reactivated.id };
        }),
    );
    return { ok: true, data: result };
  } catch (e: unknown) {
    return { ok: false, error: errorMessage(e, "Failed to reactivate channel") };
  }
}
