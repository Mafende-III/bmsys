import type { Prisma } from "@prisma/client";
import type { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { withIdempotency } from "@/lib/idempotency";
import { savePurchaseDraftSchema } from "./schema";

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
 * Compute a single purchase line's total in RWF.
 * unitCost is per CARTON. A loose unit costs `unitCost / unitsPerCarton`,
 * rounded to integer RWF.
 */
function lineTotal(
  qtyCartons: number,
  qtyLooseUnits: number,
  unitCost: number,
  unitsPerCarton: number,
): number {
  const cartonsTotal = qtyCartons * unitCost;
  const perUnitCost = unitsPerCarton > 0 ? unitCost / unitsPerCarton : 0;
  const looseTotal = Math.round(perUnitCost * qtyLooseUnits);
  return cartonsTotal + looseTotal;
}

/**
 * Create or update a DRAFT purchase. If `purchaseId` is null, create a
 * new draft. If it's an existing id, the purchase must still be DRAFT
 * (received/cancelled purchases are immutable).
 */
export async function savePurchaseDraftOp(
  userId: string,
  idempotencyKey: string,
  purchaseId: string | null,
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = savePurchaseDraftSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const input = parsed.data;

  try {
    const result = await withIdempotency(
      idempotencyKey,
      purchaseId === null
        ? "purchases.create"
        : `purchases.update.${purchaseId}`,
      () =>
        prisma.$transaction(async (tx) => {
          // Validate supplier exists
          const supplier = await tx.supplier.findUnique({
            where: { id: input.supplierId },
          });
          if (!supplier) throw new Error("Supplier not found");

          // Hydrate each line with its product (for unitsPerCarton + sanity)
          const productIds = input.lines.map((l) => l.productId);
          const products = await tx.product.findMany({
            where: { id: { in: productIds } },
            select: { id: true, unitsPerCarton: true, active: true },
          });
          const productById = new Map(products.map((p) => [p.id, p]));
          for (const l of input.lines) {
            const p = productById.get(l.productId);
            if (!p) throw new Error(`Unknown product: ${l.productId}`);
            if (!p.active) throw new Error("Archived products cannot be on a draft purchase");
          }

          const totalCost = input.lines.reduce(
            (sum, l) =>
              sum +
              lineTotal(
                l.qtyCartons,
                l.qtyLooseUnits,
                l.unitCost,
                productById.get(l.productId)!.unitsPerCarton,
              ),
            0,
          );

          let purchaseRecord;
          if (purchaseId === null) {
            purchaseRecord = await tx.purchase.create({
              data: {
                supplierId: input.supplierId,
                date: input.date,
                status: "DRAFT",
                totalCost,
                note: input.note ?? null,
                userId,
              },
            });
          } else {
            const existing = await tx.purchase.findUniqueOrThrow({
              where: { id: purchaseId },
            });
            if (existing.status !== "DRAFT") {
              throw new Error(
                `Cannot edit purchase in status ${existing.status}`,
              );
            }
            purchaseRecord = await tx.purchase.update({
              where: { id: purchaseId },
              data: {
                supplierId: input.supplierId,
                date: input.date,
                totalCost,
                note: input.note ?? null,
              },
            });
            // Wipe existing lines so we can recreate from the form input
            await tx.purchaseLine.deleteMany({
              where: { purchaseId: purchaseRecord.id },
            });
          }

          if (input.lines.length > 0) {
            await tx.purchaseLine.createMany({
              data: input.lines.map((l) => ({
                purchaseId: purchaseRecord.id,
                productId: l.productId,
                qtyCartons: l.qtyCartons,
                qtyLooseUnits: l.qtyLooseUnits,
                unitCost: l.unitCost,
                lineTotal: lineTotal(
                  l.qtyCartons,
                  l.qtyLooseUnits,
                  l.unitCost,
                  productById.get(l.productId)!.unitsPerCarton,
                ),
              })),
            });
          }

          await tx.auditLog.create({
            data: {
              tableName: "purchases",
              recordId: purchaseRecord.id,
              action: purchaseId === null ? "INSERT" : "UPDATE",
              changes: {
                supplierId: input.supplierId,
                date: input.date,
                note: input.note ?? null,
                lineCount: input.lines.length,
                totalCost,
              } as Prisma.InputJsonValue,
              userId,
            },
          });

          return { id: purchaseRecord.id };
        }),
    );
    return { ok: true, data: result };
  } catch (e: unknown) {
    return { ok: false, error: errorMessage(e, "Failed to save purchase") };
  }
}

/**
 * Transition a DRAFT purchase to RECEIVED. Writes one stock_moves row
 * per line, atomically.
 */
export async function receivePurchaseOp(
  userId: string,
  idempotencyKey: string,
  id: string,
): Promise<ActionResult<{ id: string; movesCreated: number }>> {
  try {
    const result = await withIdempotency(
      idempotencyKey,
      `purchases.receive.${id}`,
      () =>
        prisma.$transaction(async (tx) => {
          const purchase = await tx.purchase.findUniqueOrThrow({
            where: { id },
            include: {
              lines: { include: { product: { select: { unitsPerCarton: true } } } },
            },
          });

          if (purchase.status === "RECEIVED") return { id, movesCreated: 0 };
          if (purchase.status !== "DRAFT") {
            throw new Error(
              `Cannot receive a ${purchase.status} purchase`,
            );
          }
          if (purchase.lines.length === 0) {
            throw new Error("Cannot receive an empty purchase — add at least one line");
          }

          let movesCreated = 0;
          for (const l of purchase.lines) {
            const units =
              l.qtyCartons * l.product.unitsPerCarton + l.qtyLooseUnits;
            if (units <= 0) {
              throw new Error("Each line must add at least one unit");
            }
            await tx.stockMove.create({
              data: {
                productId: l.productId,
                qtyUnits: units,
                reason: "PURCHASE",
                refType: "purchase",
                refId: purchase.id,
                userId,
              },
            });
            movesCreated += 1;
          }

          await tx.purchase.update({
            where: { id },
            data: { status: "RECEIVED" },
          });

          await tx.auditLog.create({
            data: {
              tableName: "purchases",
              recordId: id,
              action: "UPDATE",
              changes: {
                statusChange: { from: "DRAFT", to: "RECEIVED" },
                stockMovesCreated: movesCreated,
              } as Prisma.InputJsonValue,
              userId,
            },
          });

          return { id, movesCreated };
        }),
    );
    return { ok: true, data: result };
  } catch (e: unknown) {
    return { ok: false, error: errorMessage(e, "Failed to receive purchase") };
  }
}

/**
 * Cancel a purchase. DRAFT cancels are simple status changes. RECEIVED
 * cancels write reverse (negative) stock_moves with reason=RETURN —
 * refused if there isn't enough current stock to unwind (i.e. some of
 * the received units have already been sold).
 */
export async function cancelPurchaseOp(
  userId: string,
  idempotencyKey: string,
  id: string,
): Promise<ActionResult<{ id: string; reversingMoves: number }>> {
  try {
    const result = await withIdempotency(
      idempotencyKey,
      `purchases.cancel.${id}`,
      () =>
        prisma.$transaction(async (tx) => {
          const purchase = await tx.purchase.findUniqueOrThrow({
            where: { id },
            include: {
              lines: { include: { product: { select: { unitsPerCarton: true } } } },
            },
          });

          if (purchase.status === "CANCELLED")
            return { id, reversingMoves: 0 };

          let reversingMoves = 0;

          if (purchase.status === "RECEIVED") {
            // Check each product has enough stock to reverse
            for (const l of purchase.lines) {
              const unitsToReverse =
                l.qtyCartons * l.product.unitsPerCarton + l.qtyLooseUnits;
              const sum = await tx.stockMove.aggregate({
                where: { productId: l.productId },
                _sum: { qtyUnits: true },
              });
              const current = sum._sum.qtyUnits ?? 0;
              if (current < unitsToReverse) {
                throw new Error(
                  `Cannot cancel: ${unitsToReverse - current} unit(s) of stock are already gone (sold or adjusted). Use an Adjustment instead.`,
                );
              }
            }

            // All clear — write reversing RETURN moves
            for (const l of purchase.lines) {
              const units =
                l.qtyCartons * l.product.unitsPerCarton + l.qtyLooseUnits;
              await tx.stockMove.create({
                data: {
                  productId: l.productId,
                  qtyUnits: -units,
                  reason: "RETURN",
                  refType: "purchase",
                  refId: purchase.id,
                  note: "Purchase cancelled after receive",
                  userId,
                },
              });
              reversingMoves += 1;
            }
          }

          await tx.purchase.update({
            where: { id },
            data: { status: "CANCELLED" },
          });

          await tx.auditLog.create({
            data: {
              tableName: "purchases",
              recordId: id,
              action: "UPDATE",
              changes: {
                statusChange: { from: purchase.status, to: "CANCELLED" },
                reversingStockMoves: reversingMoves,
              } as Prisma.InputJsonValue,
              userId,
            },
          });

          return { id, reversingMoves };
        }),
    );
    return { ok: true, data: result };
  } catch (e: unknown) {
    return { ok: false, error: errorMessage(e, "Failed to cancel purchase") };
  }
}
