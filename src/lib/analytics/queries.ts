import { prisma } from "@/lib/prisma";
import type { Period } from "./period";

/**
 * Owner-facing analytics queries. All numeric outputs are integer
 * RWF (per the system-wide money convention) and all derived stock
 * is in units (cartons converted at write time, never stored).
 *
 * COGS approach: weighted-average against the *current* per-product
 * cost. This is the v1 approximation — see docs/spec or PR
 * discussion. Once costAtSale is snapshotted on SaleLine we can
 * swap this query to use historical cost without changing callers.
 */

export type OverviewKPIs = {
  revenue: number;
  expenses: number;
  cogs: number;
  net: number;
  salesCount: number;
  prev: {
    revenue: number;
    expenses: number;
    cogs: number;
    net: number;
    salesCount: number;
  };
};

export type ChannelRow = {
  channelId: string;
  channelName: string;
  total: number;
  count: number;
};

export type DailySalesRow = {
  date: Date;
  total: number;
  count: number;
};

export type TopProductRow = {
  productId: string;
  sku: string;
  name: string;
  unitsSold: number;
  revenue: number;
};

export type ExpenseRow = {
  categoryId: string;
  categoryName: string;
  total: number;
  count: number;
};

export type StockHealth = {
  totalStockValue: number;
  lowStock: Array<{
    productId: string;
    sku: string;
    name: string;
    units: number;
    threshold: number;
  }>;
  outOfStock: Array<{ productId: string; sku: string; name: string }>;
  activeProductCount: number;
};

/**
 * Sums sale-line totals and counts for a half-open date range,
 * excluding voided sales. Used as the revenue side of the period
 * KPIs and as the building block for channel + daily charts.
 */
async function sumSalesInRange(
  from: Date,
  to: Date,
): Promise<{ revenue: number; salesCount: number }> {
  const agg = await prisma.sale.aggregate({
    where: { date: { gte: from, lte: to }, status: "COMPLETE" },
    _sum: { total: true },
    _count: true,
  });
  return {
    revenue: agg._sum.total ?? 0,
    salesCount: agg._count,
  };
}

/**
 * Sums expense.amount in the range. Mirrors the structure used by
 * the daily report so KPIs reconcile.
 */
async function sumExpensesInRange(from: Date, to: Date): Promise<number> {
  const agg = await prisma.expense.aggregate({
    where: { date: { gte: from, lte: to } },
    _sum: { amount: true },
  });
  return agg._sum.amount ?? 0;
}

/**
 * Approximates COGS for the period using the current product cost.
 * Pulls every sale line in the window, multiplies qty (converted to
 * units) by the product's costPerCarton / unitsPerCarton. See note
 * at top of file about the v1 approximation.
 */
async function computeCogsForRange(from: Date, to: Date): Promise<number> {
  const lines = await prisma.saleLine.findMany({
    where: { sale: { date: { gte: from, lte: to }, status: "COMPLETE" } },
    include: {
      product: {
        select: { costPerCarton: true, unitsPerCarton: true },
      },
    },
  });
  let cogs = 0;
  for (const l of lines) {
    const upc = l.product.unitsPerCarton || 1;
    const costPerUnit = l.product.costPerCarton / upc;
    const units = l.saleUnit === "CARTON" ? l.qty * upc : l.qty;
    cogs += Math.round(units * costPerUnit);
  }
  return cogs;
}

export async function getOverviewKPIs(period: Period): Promise<OverviewKPIs> {
  const [{ revenue, salesCount }, expenses, cogs] = await Promise.all([
    sumSalesInRange(period.from, period.to),
    sumExpensesInRange(period.from, period.to),
    computeCogsForRange(period.from, period.to),
  ]);
  const [
    { revenue: pRevenue, salesCount: pSalesCount },
    pExpenses,
    pCogs,
  ] = await Promise.all([
    sumSalesInRange(period.prevFrom, period.prevTo),
    sumExpensesInRange(period.prevFrom, period.prevTo),
    computeCogsForRange(period.prevFrom, period.prevTo),
  ]);
  return {
    revenue,
    expenses,
    cogs,
    net: revenue - cogs - expenses,
    salesCount,
    prev: {
      revenue: pRevenue,
      expenses: pExpenses,
      cogs: pCogs,
      net: pRevenue - pCogs - pExpenses,
      salesCount: pSalesCount,
    },
  };
}

export async function getSalesByDay(period: Period): Promise<DailySalesRow[]> {
  const sales = await prisma.sale.findMany({
    where: {
      date: { gte: period.from, lte: period.to },
      status: "COMPLETE",
    },
    select: { date: true, total: true },
  });
  const buckets = new Map<string, { total: number; count: number }>();
  for (const s of sales) {
    const k = ymdKey(s.date);
    const cur = buckets.get(k) ?? { total: 0, count: 0 };
    cur.total += s.total;
    cur.count += 1;
    buckets.set(k, cur);
  }
  const rows: DailySalesRow[] = [];
  for (let i = 0; i < period.days; i++) {
    const d = new Date(period.from);
    d.setDate(d.getDate() + i);
    const k = ymdKey(d);
    const v = buckets.get(k) ?? { total: 0, count: 0 };
    rows.push({ date: d, total: v.total, count: v.count });
  }
  return rows;
}

function ymdKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function getChannelBreakdown(
  period: Period,
): Promise<ChannelRow[]> {
  const grouped = await prisma.sale.groupBy({
    by: ["channelId"],
    where: {
      date: { gte: period.from, lte: period.to },
      status: "COMPLETE",
    },
    _sum: { total: true },
    _count: true,
  });
  if (grouped.length === 0) return [];
  const channels = await prisma.channel.findMany({
    where: { id: { in: grouped.map((g) => g.channelId) } },
    select: { id: true, name: true },
  });
  const nameById = new Map(channels.map((c) => [c.id, c.name] as const));
  return grouped
    .map((g) => ({
      channelId: g.channelId,
      channelName: nameById.get(g.channelId) ?? "—",
      total: g._sum.total ?? 0,
      count: g._count,
    }))
    .sort((a, b) => b.total - a.total);
}

export async function getTopProducts(
  period: Period,
  limit = 5,
): Promise<TopProductRow[]> {
  const lines = await prisma.saleLine.findMany({
    where: {
      sale: { date: { gte: period.from, lte: period.to }, status: "COMPLETE" },
    },
    include: {
      product: { select: { sku: true, name: true, unitsPerCarton: true } },
    },
  });
  const byProduct = new Map<
    string,
    { sku: string; name: string; unitsSold: number; revenue: number }
  >();
  for (const l of lines) {
    const upc = l.product.unitsPerCarton || 1;
    const units = l.saleUnit === "CARTON" ? l.qty * upc : l.qty;
    const cur = byProduct.get(l.productId) ?? {
      sku: l.product.sku,
      name: l.product.name,
      unitsSold: 0,
      revenue: 0,
    };
    cur.unitsSold += units;
    cur.revenue += l.lineTotal;
    byProduct.set(l.productId, cur);
  }
  return Array.from(byProduct.entries())
    .map(([productId, v]) => ({ productId, ...v }))
    .sort((a, b) => b.unitsSold - a.unitsSold)
    .slice(0, limit);
}

export async function getExpenseBreakdown(
  period: Period,
): Promise<ExpenseRow[]> {
  const grouped = await prisma.expense.groupBy({
    by: ["categoryId"],
    where: { date: { gte: period.from, lte: period.to } },
    _sum: { amount: true },
    _count: true,
  });
  if (grouped.length === 0) return [];
  const cats = await prisma.expenseCategory.findMany({
    where: { id: { in: grouped.map((g) => g.categoryId) } },
    select: { id: true, name: true },
  });
  const nameById = new Map(cats.map((c) => [c.id, c.name] as const));
  return grouped
    .map((g) => ({
      categoryId: g.categoryId,
      categoryName: nameById.get(g.categoryId) ?? "—",
      total: g._sum.amount ?? 0,
      count: g._count,
    }))
    .sort((a, b) => b.total - a.total);
}

/**
 * Stock value uses the current per-product unit cost — same
 * approximation as COGS. Low / out lists exclude archived products.
 */
export async function getStockHealth(): Promise<StockHealth> {
  const products = await prisma.product.findMany({
    where: { active: true },
    select: {
      id: true,
      sku: true,
      name: true,
      unitsPerCarton: true,
      costPerCarton: true,
      lowStockThresholdUnits: true,
    },
  });

  // One aggregate over stockMoves for all products in one round-trip.
  const moves = await prisma.stockMove.groupBy({
    by: ["productId"],
    where: { productId: { in: products.map((p) => p.id) } },
    _sum: { qtyUnits: true },
  });
  const unitsByProduct = new Map<string, number>();
  for (const m of moves) {
    unitsByProduct.set(m.productId, m._sum.qtyUnits ?? 0);
  }

  let totalStockValue = 0;
  const lowStock: StockHealth["lowStock"] = [];
  const outOfStock: StockHealth["outOfStock"] = [];

  for (const p of products) {
    const units = unitsByProduct.get(p.id) ?? 0;
    const upc = p.unitsPerCarton || 1;
    const costPerUnit = p.costPerCarton / upc;
    totalStockValue += Math.round(units * costPerUnit);

    if (units <= 0) {
      outOfStock.push({ productId: p.id, sku: p.sku, name: p.name });
    } else if (
      p.lowStockThresholdUnits > 0 &&
      units <= p.lowStockThresholdUnits
    ) {
      lowStock.push({
        productId: p.id,
        sku: p.sku,
        name: p.name,
        units,
        threshold: p.lowStockThresholdUnits,
      });
    }
  }

  lowStock.sort((a, b) => a.units - b.units);
  outOfStock.sort((a, b) => a.name.localeCompare(b.name));

  return {
    totalStockValue,
    lowStock,
    outOfStock,
    activeProductCount: products.length,
  };
}

export type StockRow = {
  productId: string;
  sku: string;
  name: string;
  units: number;
  threshold: number;
  status: "out" | "low" | "ok";
};

/**
 * Complete stock breakdown for every active product — sorted by
 * urgency (out → low → ok), then by units ascending within each
 * bucket. The single source of truth for "what's on the shelves".
 */
export async function getStockList(): Promise<StockRow[]> {
  const products = await prisma.product.findMany({
    where: { active: true },
    select: {
      id: true,
      sku: true,
      name: true,
      lowStockThresholdUnits: true,
    },
  });

  const moves = await prisma.stockMove.groupBy({
    by: ["productId"],
    where: { productId: { in: products.map((p) => p.id) } },
    _sum: { qtyUnits: true },
  });
  const unitsByProduct = new Map<string, number>();
  for (const m of moves) {
    unitsByProduct.set(m.productId, m._sum.qtyUnits ?? 0);
  }

  const rows: StockRow[] = products.map((p) => {
    const units = unitsByProduct.get(p.id) ?? 0;
    const threshold = p.lowStockThresholdUnits;
    let status: StockRow["status"] = "ok";
    if (units <= 0) status = "out";
    else if (threshold > 0 && units <= threshold) status = "low";
    return { productId: p.id, sku: p.sku, name: p.name, units, threshold, status };
  });

  const rank = { out: 0, low: 1, ok: 2 } as const;
  rows.sort((a, b) => {
    if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status];
    if (a.units !== b.units) return a.units - b.units;
    return a.name.localeCompare(b.name);
  });

  return rows;
}
