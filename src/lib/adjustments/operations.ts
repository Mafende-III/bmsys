import type { Prisma } from "@prisma/client";
import type { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { withIdempotency } from "@/lib/idempotency";
import { createAdjustmentSchema } from "./schema";

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
 * Record a stock adjustment. Single transaction: insert Adjustment +
 * matching StockMove (reason mirrored, qtyUnits negated). Refuses if
 * current stock for the product is less than the requested adjustment.
 */
export async function createAdjustmentOp(
  userId: string,
  idempotencyKey: string,
  raw: unknown,
): Promise<ActionResult<{ id: string; remainingStock: number }>> {
  const parsed = createAdjustmentSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const input = parsed.data;

  try {
    const result = await withIdempotency(
      idempotencyKey,
      "adjustments.create",
      () =>
        prisma.$transaction(async (tx) => {
          const product = await tx.product.findUnique({
            where: { id: input.productId },
          });
          if (!product) throw new Error("Product not found");
          if (!product.active) throw new Error("Product is archived");

          // Defend against negative stock — adjustments only ever reduce.
          const sum = await tx.stockMove.aggregate({
            where: { productId: input.productId },
            _sum: { qtyUnits: true },
          });
          const current = sum._sum.qtyUnits ?? 0;
          if (current < input.qtyUnits) {
            throw new Error(
              `Cannot adjust: only ${current} unit(s) in stock`,
            );
          }

          const adjustment = await tx.adjustment.create({
            data: {
              productId: input.productId,
              qtyUnits: -input.qtyUnits,
              reason: input.reason,
              note: input.note,
              userId,
            },
          });

          await tx.stockMove.create({
            data: {
              productId: input.productId,
              qtyUnits: -input.qtyUnits,
              reason: input.reason,
              refType: "adjustment",
              refId: adjustment.id,
              note: input.note,
              userId,
            },
          });

          await tx.auditLog.create({
            data: {
              tableName: "adjustments",
              recordId: adjustment.id,
              action: "INSERT",
              changes: {
                productId: input.productId,
                reason: input.reason,
                qtyUnits: input.qtyUnits,
                note: input.note,
              } as Prisma.InputJsonValue,
              userId,
            },
          });

          return {
            id: adjustment.id,
            remainingStock: current - input.qtyUnits,
          };
        }),
    );
    return { ok: true, data: result };
  } catch (e) {
    return { ok: false, error: errorMessage(e, "Failed to record adjustment") };
  }
}
