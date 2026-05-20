import type { Prisma } from "@prisma/client";
import type { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { withIdempotency } from "@/lib/idempotency";
import { settingsUpdateSchema } from "./schema";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function firstError(error: ZodError): string {
  return error.errors[0]?.message ?? "Invalid input";
}

function errorMessage(e: unknown, fallback: string): string {
  return e instanceof Error ? e.message : fallback;
}

export async function updateSettingsOp(
  userId: string,
  idempotencyKey: string,
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = settingsUpdateSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const input = parsed.data;

  try {
    const result = await withIdempotency(
      idempotencyKey,
      "settings.update",
      () =>
        prisma.$transaction(async (tx) => {
          const before = await tx.settings.upsert({
            where: { id: "default" },
            update: {},
            create: { id: "default" },
          });
          const updated = await tx.settings.update({
            where: { id: "default" },
            data: input,
          });
          await tx.auditLog.create({
            data: {
              tableName: "settings",
              recordId: "default",
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
    return { ok: false, error: errorMessage(e, "Failed to update settings") };
  }
}

export async function updateLogoPathOp(
  userId: string,
  logoPath: string | null,
): Promise<ActionResult<{ id: string }>> {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const before = await tx.settings.upsert({
        where: { id: "default" },
        update: {},
        create: { id: "default" },
      });
      const updated = await tx.settings.update({
        where: { id: "default" },
        data: { logoPath },
      });
      await tx.auditLog.create({
        data: {
          tableName: "settings",
          recordId: "default",
          action: "UPDATE",
          changes: {
            before: { logoPath: before.logoPath },
            after: { logoPath: updated.logoPath },
          } as unknown as Prisma.InputJsonValue,
          userId,
        },
      });
      return { id: updated.id };
    });
    return { ok: true, data: result };
  } catch (e: unknown) {
    return { ok: false, error: errorMessage(e, "Failed to update logo") };
  }
}
