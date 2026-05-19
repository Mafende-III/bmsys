import type { Prisma } from "@prisma/client";
import type { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { withIdempotency } from "@/lib/idempotency";
import { createExpenseSchema, recurringSchema } from "./schema";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function firstError(error: ZodError): string {
  return error.errors[0]?.message ?? "Invalid input";
}

function errorMessage(e: unknown, fallback: string): string {
  return e instanceof Error ? e.message : fallback;
}

export async function createExpenseOp(
  userId: string,
  idempotencyKey: string,
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = createExpenseSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const input = parsed.data;

  try {
    const result = await withIdempotency(idempotencyKey, "expenses.create", () =>
      prisma.$transaction(async (tx) => {
        const category = await tx.expenseCategory.findUnique({
          where: { id: input.categoryId },
        });
        if (!category) throw new Error("Expense category not found");

        if (input.supplierId) {
          const supplier = await tx.supplier.findUnique({
            where: { id: input.supplierId },
          });
          if (!supplier) throw new Error("Supplier not found");
        }

        // CASH expenses require an open cash session (mirrors the rule
        // we added for CASH sales in Sprint 7).
        if (input.paymentMethod === "CASH") {
          const open = await tx.cashSession.findFirst({
            where: { closedAt: null },
          });
          if (!open) {
            throw new Error(
              "Till is closed. Open a cash session before recording cash expenses.",
            );
          }
        }

        const expense = await tx.expense.create({
          data: {
            date: input.date,
            amount: input.amount,
            categoryId: input.categoryId,
            description: input.description,
            paymentMethod: input.paymentMethod,
            paymentReference: input.paymentReference ?? null,
            supplierId: input.supplierId ?? null,
            userId,
          },
        });

        await tx.auditLog.create({
          data: {
            tableName: "expenses",
            recordId: expense.id,
            action: "INSERT",
            changes: {
              date: input.date,
              amount: input.amount,
              categoryId: input.categoryId,
              paymentMethod: input.paymentMethod,
            } as Prisma.InputJsonValue,
            userId,
          },
        });

        return { id: expense.id };
      }),
    );
    return { ok: true, data: result };
  } catch (e) {
    return { ok: false, error: errorMessage(e, "Failed to record expense") };
  }
}

export async function upsertRecurringOp(
  userId: string,
  idempotencyKey: string,
  id: string | null,
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = recurringSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const input = parsed.data;

  try {
    const result = await withIdempotency(
      idempotencyKey,
      id === null ? "recurring.create" : `recurring.update.${id}`,
      () =>
        prisma.$transaction(async (tx) => {
          const category = await tx.expenseCategory.findUnique({
            where: { id: input.categoryId },
          });
          if (!category) throw new Error("Expense category not found");

          let row;
          if (id === null) {
            row = await tx.recurringExpense.create({ data: input });
          } else {
            const before = await tx.recurringExpense.findUniqueOrThrow({
              where: { id },
            });
            row = await tx.recurringExpense.update({
              where: { id },
              data: input,
            });
            await tx.auditLog.create({
              data: {
                tableName: "recurring_expenses",
                recordId: id,
                action: "UPDATE",
                changes: {
                  before,
                  after: row,
                } as unknown as Prisma.InputJsonValue,
                userId,
              },
            });
            return { id: row.id };
          }

          await tx.auditLog.create({
            data: {
              tableName: "recurring_expenses",
              recordId: row.id,
              action: "INSERT",
              changes: input as Prisma.InputJsonValue,
              userId,
            },
          });
          return { id: row.id };
        }),
    );
    return { ok: true, data: result };
  } catch (e) {
    return { ok: false, error: errorMessage(e, "Failed to save recurring entry") };
  }
}

/**
 * Manually run every active recurring entry that's due today and not
 * yet run today. Idempotent within the same day — calling twice on
 * the same day produces no extra rows.
 */
export async function runDueRecurringOp(
  userId: string,
  idempotencyKey: string,
): Promise<ActionResult<{ created: number }>> {
  const now = new Date();
  const startOfDay = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );

  try {
    const result = await withIdempotency(
      idempotencyKey,
      "recurring.run",
      () =>
        prisma.$transaction(async (tx) => {
          const candidates = await tx.recurringExpense.findMany({
            where: { active: true },
            include: { category: true },
          });

          let created = 0;
          for (const r of candidates) {
            const isDue =
              r.frequency === "MONTHLY"
                ? r.dayOfPeriod === now.getDate()
                : r.dayOfPeriod === now.getDay();
            if (!isDue) continue;

            // Already ran today?
            if (r.lastRunAt && r.lastRunAt >= startOfDay) continue;

            await tx.expense.create({
              data: {
                date: now,
                amount: r.amount,
                categoryId: r.categoryId,
                description: r.description,
                paymentMethod: "CASH", // default; can be overridden by editing
                supplierId: null,
                recurringId: r.id,
                userId,
              },
            });
            await tx.recurringExpense.update({
              where: { id: r.id },
              data: { lastRunAt: now },
            });
            created += 1;
          }

          if (created > 0) {
            await tx.auditLog.create({
              data: {
                tableName: "recurring_expenses",
                recordId: "BATCH",
                action: "UPDATE",
                changes: { ranAt: now, created } as Prisma.InputJsonValue,
                userId,
              },
            });
          }

          return { created };
        }),
    );
    return { ok: true, data: result };
  } catch (e) {
    return { ok: false, error: errorMessage(e, "Failed to run recurring") };
  }
}
