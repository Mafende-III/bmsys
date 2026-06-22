import type { Prisma } from "@prisma/client";
import type { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { withIdempotency } from "@/lib/idempotency";
import { stockTakeSchema } from "./schema";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function firstError(error: ZodError): string {
  return error.errors[0]?.message ?? "Invalid input";
}

function errorMessage(e: unknown, fallback: string): string {
  return e instanceof Error ? e.message : fallback;
}

export type StockTakeResult = {
  id: string;
  adjustedCount: number;
  totalProducts: number;
};

/**
 * Records a stock-take. For each product line, computes:
 *
 *   counted total = countedCartons × unitsPerCarton + countedLooseUnits
 *   variance      = counted total − system total
 *
 * Writes one StockMove with reason STOCKTAKE_VARIANCE per non-zero
 * variance, signed. Matching lines aren't written so the ledger
 * stays quiet on normal counts.
 *
 * Whole batch is one transaction, one AuditLog row, one idempotency
 * key — retried submissions can't double-write.
 *
 * Note: this only reconciles the *total* units. The Carton table's
 * OPENED/EMPTY state isn't touched; if the sealed-vs-loose split is
 * out of sync, it self-corrects on the next sale or carton open.
 */
export async function runStockTakeOp(
  userId: string,
  idempotencyKey: string,
  raw: unknown,
): Promise<ActionResult<StockTakeResult>> {
  const parsed = stockTakeSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const input = parsed.data;

  try {
    const result = await withIdempotency(
      idempotencyKey,
      "stock-takes.run",
      () =>
        prisma.$transaction(async (tx) => {
          const productIds = input.lines.map((l) => l.productId);
          const products = await tx.product.findMany({
            where: { id: { in: productIds }, active: true },
            select: {
              id: true,
              sku: true,
              name: true,
              unitsPerCarton: true,
            },
          });
          const productById = new Map(products.map((p) => [p.id, p]));

          const sums = await tx.stockMove.groupBy({
            by: ["productId"],
            where: { productId: { in: productIds } },
            _sum: { qtyUnits: true },
          });
          const sysByProduct = new Map<string, number>();
          for (const s of sums) {
            sysByProduct.set(s.productId, s._sum.qtyUnits ?? 0);
          }

          const auditLines: Array<{
            productId: string;
            sku: string;
            name: string;
            system: number;
            counted: number;
            countedCartons: number;
            countedLooseUnits: number;
            variance: number;
          }> = [];
          let adjustedCount = 0;
          const moveCreates: Prisma.StockMoveCreateManyInput[] = [];

          for (const line of input.lines) {
            const product = productById.get(line.productId);
            if (!product) continue; // archived or unknown — skip silently
            const upc = product.unitsPerCarton || 1;
            const counted =
              line.countedCartons * upc + line.countedLooseUnits;
            const system = sysByProduct.get(product.id) ?? 0;
            const variance = counted - system;
            auditLines.push({
              productId: product.id,
              sku: product.sku,
              name: product.name,
              system,
              counted,
              countedCartons: line.countedCartons,
              countedLooseUnits: line.countedLooseUnits,
              variance,
            });
            if (variance === 0) continue;
            moveCreates.push({
              productId: product.id,
              qtyUnits: variance,
              reason: "STOCKTAKE_VARIANCE",
              refType: "stock-take",
              note: input.note,
              userId,
            });
            adjustedCount += 1;
          }

          if (moveCreates.length > 0) {
            await tx.stockMove.createMany({ data: moveCreates });
          }

          const audit = await tx.auditLog.create({
            data: {
              tableName: "stock_takes",
              recordId: "n/a",
              action: "INSERT",
              changes: {
                note: input.note,
                lineCount: auditLines.length,
                adjustedCount,
                lines: auditLines,
              } as Prisma.InputJsonValue,
              userId,
            },
          });

          return {
            id: audit.id,
            adjustedCount,
            totalProducts: input.lines.length,
          };
        }),
    );
    return { ok: true, data: result };
  } catch (e: unknown) {
    return { ok: false, error: errorMessage(e, "Failed to record stock-take") };
  }
}
