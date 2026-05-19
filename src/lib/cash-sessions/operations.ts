import type { Prisma } from "@prisma/client";
import type { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { withIdempotency } from "@/lib/idempotency";
import {
  closeCashSessionSchema,
  openCashSessionSchema,
} from "./schema";
import { sumCashSalesForSession } from "./queries";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function firstError(error: ZodError): string {
  return error.errors[0]?.message ?? "Invalid input";
}

function errorMessage(e: unknown, fallback: string): string {
  return e instanceof Error ? e.message : fallback;
}

/**
 * Open a new cash session. Refuses if one is already open. Single-tenant
 * means we don't worry about concurrent opens — the transaction's
 * findFirst inside the same $transaction would race, but a UNIQUE
 * partial index would be the proper fix when we go multi-user.
 */
export async function openSessionOp(
  userId: string,
  idempotencyKey: string,
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = openCashSessionSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const input = parsed.data;

  try {
    const result = await withIdempotency(
      idempotencyKey,
      "cash-sessions.open",
      () =>
        prisma.$transaction(async (tx) => {
          const existing = await tx.cashSession.findFirst({
            where: { closedAt: null },
          });
          if (existing) {
            throw new Error(
              "Another cash session is already open. Close it before opening a new one.",
            );
          }
          const session = await tx.cashSession.create({
            data: {
              openingFloat: input.openingFloat,
              openedById: userId,
              note: input.note ?? null,
            },
          });
          await tx.auditLog.create({
            data: {
              tableName: "cash_sessions",
              recordId: session.id,
              action: "INSERT",
              changes: {
                openingFloat: input.openingFloat,
                note: input.note ?? null,
              } as Prisma.InputJsonValue,
              userId,
            },
          });
          return { id: session.id };
        }),
    );
    return { ok: true, data: result };
  } catch (e) {
    return { ok: false, error: errorMessage(e, "Failed to open cash session") };
  }
}

export async function closeSessionOp(
  userId: string,
  idempotencyKey: string,
  id: string,
  raw: unknown,
): Promise<
  ActionResult<{
    id: string;
    expectedCash: number;
    variance: number;
  }>
> {
  const parsed = closeCashSessionSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const input = parsed.data;

  try {
    const result = await withIdempotency(
      idempotencyKey,
      `cash-sessions.close.${id}`,
      () =>
        prisma.$transaction(async (tx) => {
          const session = await tx.cashSession.findUniqueOrThrow({
            where: { id },
          });
          if (session.closedAt) {
            throw new Error("Session is already closed");
          }

          const closedAt = new Date();
          const sums = await sumCashSalesForSession(
            tx,
            session.openedAt,
            closedAt,
          );
          const expectedCash = session.openingFloat + sums.total;
          const variance = input.closingCount - expectedCash;

          const updated = await tx.cashSession.update({
            where: { id },
            data: {
              closedAt,
              closedById: userId,
              closingCount: input.closingCount,
              expectedCash,
              variance,
              note: input.note ?? session.note,
            },
          });

          await tx.auditLog.create({
            data: {
              tableName: "cash_sessions",
              recordId: id,
              action: "UPDATE",
              changes: {
                closedAt,
                closingCount: input.closingCount,
                expectedCash,
                variance,
                cashSalesCount: sums.count,
                cashSalesTotal: sums.total,
              } as Prisma.InputJsonValue,
              userId,
            },
          });

          return {
            id: updated.id,
            expectedCash,
            variance,
          };
        }),
    );
    return { ok: true, data: result };
  } catch (e) {
    return { ok: false, error: errorMessage(e, "Failed to close cash session") };
  }
}
