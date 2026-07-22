import { prisma } from "@/lib/prisma";
import {
  BURN_WINDOW_DAYS,
  computeRestockLine,
  type RestockLine,
} from "./plan";

export type RestockRow = RestockLine & {
  productId: string;
  sku: string;
  name: string;
  stockUnits: number;
  unitsPerCarton: number;
  costPerCarton: number;
};

export type RestockPlan = {
  rows: RestockRow[];
  /// Rows needing an order (suggestedCartons > 0), most urgent first.
  orderRows: RestockRow[];
  totalOrderCost: number;
  urgentCount: number;
};

const URGENCY_RANK = { OUT: 0, CRITICAL: 1, LOW: 2, OK: 3 } as const;

/**
 * Restock plan across all active products. Burn = SALE_UNIT/SALE_CARTON
 * stock moves over the last BURN_WINDOW_DAYS (negative deltas, absolute
 * value). Stock = full ledger sum, same derivation as everywhere else.
 */
export async function getRestockPlan(): Promise<RestockPlan> {
  const products = await prisma.product.findMany({
    where: { active: true },
    orderBy: { sku: "asc" },
    select: {
      id: true,
      sku: true,
      name: true,
      unitsPerCarton: true,
      costPerCarton: true,
    },
  });
  if (products.length === 0) {
    return { rows: [], orderRows: [], totalOrderCost: 0, urgentCount: 0 };
  }
  const ids = products.map((p) => p.id);
  const windowStart = new Date(
    Date.now() - BURN_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  );

  const [stockSums, saleSums] = await Promise.all([
    prisma.stockMove.groupBy({
      by: ["productId"],
      where: { productId: { in: ids } },
      _sum: { qtyUnits: true },
    }),
    prisma.stockMove.groupBy({
      by: ["productId"],
      where: {
        productId: { in: ids },
        reason: { in: ["SALE_UNIT", "SALE_CARTON"] },
        createdAt: { gte: windowStart },
      },
      _sum: { qtyUnits: true },
    }),
  ]);
  const stockById = new Map(
    stockSums.map((s) => [s.productId, s._sum.qtyUnits ?? 0]),
  );
  // Sale moves are negative deltas; flip the sign to get units sold.
  const soldById = new Map(
    saleSums.map((s) => [s.productId, Math.abs(s._sum.qtyUnits ?? 0)]),
  );

  const rows: RestockRow[] = products.map((p) => {
    const stockUnits = stockById.get(p.id) ?? 0;
    const line = computeRestockLine({
      stockUnits,
      unitsSoldInWindow: soldById.get(p.id) ?? 0,
      unitsPerCarton: p.unitsPerCarton,
      costPerCarton: p.costPerCarton,
    });
    return {
      productId: p.id,
      sku: p.sku,
      name: p.name,
      stockUnits,
      unitsPerCarton: p.unitsPerCarton,
      costPerCarton: p.costPerCarton,
      ...line,
    };
  });

  rows.sort((a, b) => {
    const r = URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency];
    if (r !== 0) return r;
    return (a.daysToOut ?? Infinity) - (b.daysToOut ?? Infinity);
  });

  const orderRows = rows.filter((r) => r.suggestedCartons > 0);
  return {
    rows,
    orderRows,
    totalOrderCost: orderRows.reduce((a, r) => a + r.estimatedCost, 0),
    urgentCount: rows.filter(
      (r) => r.urgency === "OUT" || r.urgency === "CRITICAL",
    ).length,
  };
}
