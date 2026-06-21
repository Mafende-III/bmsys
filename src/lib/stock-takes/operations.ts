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
 * Records a stock-take: for every product whose counted units differ
 * from the system's derived stock, writes one StockMove with the
 * signed variance and reason STOCKTAKE_VARIANCE. Products whose
 * counts match are not written — only real variances land in the
 * ledger.
 *
 * The whole batch is one transaction, one AuditLog entry, and one
 * idempotency key — so a retried submission can't double-write.
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
          // Re-derive current system stock inside the transaction so a
          // sale that lands a moment before the stock-take is reflected.
          const productIds = input.lines.map((l) => l.productId);
          const products = await tx.product.findMany({
            where: { id: { in: productIds }, active: true },
            select: { id: true, sku: true, name: true },
          });
          const knownIds = new Set(products.map((p) => p.id));

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
            variance: number;
          }> = [];
          let adjustedCount = 0;
          const moveCreates: Prisma.StockMoveCreateManyInput[] = [];

          for (const line of input.lines) {
            if (!knownIds.has(line.productId)) continue;
            const product = products.find((p) => p.id === line.productId);
            if (!product) continue;
            const system = sysByProduct.get(line.productId) ?? 0;
            const counted = line.countedUnits;
            const variance = counted - system;
            auditLines.push({
              productId: product.id,
              sku: product.sku,
              name: product.name,
              system,
              counted,
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
