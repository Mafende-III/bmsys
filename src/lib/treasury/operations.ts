import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function errorMessage(e: unknown, fallback: string): string {
  return e instanceof Error ? e.message : fallback;
}

export const recordTransferSchema = z.object({
  amount: z.coerce
    .number({ invalid_type_error: "Amount is required" })
    .int("Whole RWF only")
    .min(1, "Amount must be at least 1 RWF"),
  toMethod: z.enum(["MOMO", "BANK"]),
  reference: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? null : v),
    z.string().trim().max(200).nullable().optional(),
  ),
  note: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? null : v),
    z.string().trim().max(500).nullable().optional(),
  ),
});

/**
 * Records physical cash leaving the drawer for MoMo or the bank.
 * Owner-only. The amount is capped against nothing here — the owner
 * may deposit cash that predates the current session — but the till
 * close math subtracts transfers made during the session, so the
 * variance stays honest.
 */
export async function recordCashTransferOp(
  userId: string,
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = recordTransferSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.errors[0]?.message ?? "Invalid input",
    };
  }
  const input = parsed.data;
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (user?.role !== "OWNER") {
      return { ok: false, error: "Only the owner can move cash" };
    }
    const created = await prisma.$transaction(async (tx) => {
      const t = await tx.cashTransfer.create({
        data: {
          amount: input.amount,
          toMethod: input.toMethod,
          reference: input.reference ?? null,
          note: input.note ?? null,
          userId,
        },
      });
      await tx.auditLog.create({
        data: {
          tableName: "CashTransfer",
          recordId: t.id,
          action: "INSERT",
          changes: {
            amount: input.amount,
            toMethod: input.toMethod,
            reference: input.reference ?? null,
          } as Prisma.InputJsonValue,
          userId,
        },
      });
      return t;
    });
    return { ok: true, data: { id: created.id } };
  } catch (e: unknown) {
    return { ok: false, error: errorMessage(e, "Failed to record transfer") };
  }
}

export const checkpointSchema = z.object({
  momoBalance: z.coerce
    .number({ invalid_type_error: "MoMo balance must be a number" })
    .int()
    .min(0)
    .nullable()
    .optional(),
  bankBalance: z.coerce
    .number({ invalid_type_error: "Bank balance must be a number" })
    .int()
    .min(0)
    .nullable()
    .optional(),
});

/**
 * Sets the "balance right now" checkpoint for MoMo and/or Bank. Only
 * the fields provided are updated; each sets its checkpointAt to now
 * so the derived balance restarts from a verified statement figure.
 */
export async function setCheckpointsOp(
  userId: string,
  raw: unknown,
): Promise<ActionResult<{ updated: string[] }>> {
  const parsed = checkpointSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.errors[0]?.message ?? "Invalid input",
    };
  }
  const input = parsed.data;
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (user?.role !== "OWNER") {
      return { ok: false, error: "Only the owner can set balances" };
    }
    const now = new Date();
    const data: Prisma.SettingsUpdateInput = {};
    const updated: string[] = [];
    if (input.momoBalance != null) {
      data.momoOpeningBalance = input.momoBalance;
      data.momoCheckpointAt = now;
      updated.push("MOMO");
    }
    if (input.bankBalance != null) {
      data.bankOpeningBalance = input.bankBalance;
      data.bankCheckpointAt = now;
      updated.push("BANK");
    }
    if (updated.length === 0) {
      return { ok: false, error: "Nothing to update" };
    }
    await prisma.$transaction(async (tx) => {
      await tx.settings.upsert({
        where: { id: "default" },
        create: { id: "default", ...(data as Prisma.SettingsCreateInput) },
        update: data,
      });
      await tx.auditLog.create({
        data: {
          tableName: "Settings",
          recordId: "default",
          action: "UPDATE",
          changes: {
            checkpoint: updated,
            momoBalance: input.momoBalance ?? undefined,
            bankBalance: input.bankBalance ?? undefined,
          } as Prisma.InputJsonValue,
          userId,
        },
      });
    });
    return { ok: true, data: { updated } };
  } catch (e: unknown) {
    return { ok: false, error: errorMessage(e, "Failed to set balances") };
  }
}
