import { prisma } from "@/lib/prisma";

export type StockTakeRow = {
  productId: string;
  sku: string;
  name: string;
  unitsPerCarton: number;
  systemTotalUnits: number;
  systemSealedCartons: number;
  systemLooseUnits: number;
};

export type StockTakeHistoryLine = {
  productId: string;
  sku: string;
  name: string;
  system: number;
  counted: number;
  countedCartons: number;
  countedLooseUnits: number;
  variance: number;
};

export type StockTakeHistoryEntry = {
  id: string;
  createdAt: Date;
  userName: string | null;
  note: string;
  lineCount: number;
  adjustedCount: number;
  lines: StockTakeHistoryLine[];
};

/**
 * Every active product with the system's view of stock broken down
 * the same way the owner will count it: sealed cartons + loose units.
 *
 * Sealed cartons come from the difference between the total stock
 * (StockMove sum) and the units remaining in OPENED cartons. The
 * remainder after dividing into full cartons is treated as additional
 * loose units (e.g. if the ledger and carton state ever drift, the
 * leftover lands here).
 *
 * Sorted by SKU so a printed count sheet matches the on-screen order.
 */
export async function listStockTakeRows(): Promise<StockTakeRow[]> {
  const products = await prisma.product.findMany({
    where: { active: true },
    orderBy: { sku: "asc" },
    select: { id: true, sku: true, name: true, unitsPerCarton: true },
  });

  if (products.length === 0) return [];

  const productIds = products.map((p) => p.id);

  const [stockSums, openedSums] = await Promise.all([
    prisma.stockMove.groupBy({
      by: ["productId"],
      where: { productId: { in: productIds } },
      _sum: { qtyUnits: true },
    }),
    prisma.carton.groupBy({
      by: ["productId"],
      where: { productId: { in: productIds }, state: "OPENED" },
      _sum: { unitsRemaining: true },
    }),
  ]);

  const totalById = new Map(
    stockSums.map((s) => [s.productId, s._sum.qtyUnits ?? 0]),
  );
  const openedById = new Map(
    openedSums.map((s) => [s.productId, s._sum.unitsRemaining ?? 0]),
  );

  return products.map((p) => {
    const totalUnits = totalById.get(p.id) ?? 0;
    const openedUnits = openedById.get(p.id) ?? 0;
    const sealedUnits = Math.max(0, totalUnits - openedUnits);
    const upc = p.unitsPerCarton || 1;
    const sealedCartons = Math.floor(sealedUnits / upc);
    // Anything not in a full sealed carton is treated as loose.
    const looseUnits = totalUnits - sealedCartons * upc;
    return {
      productId: p.id,
      sku: p.sku,
      name: p.name,
      unitsPerCarton: upc,
      systemTotalUnits: totalUnits,
      systemSealedCartons: sealedCartons,
      systemLooseUnits: Math.max(0, looseUnits),
    };
  });
}

/**
 * Recent stock-takes pulled from the audit log. Each row carries
 * the full per-line breakdown that was submitted — what the system
 * showed, what the owner counted (cartons + loose), and the variance
 * we wrote to the ledger. Limit is small because each row can carry
 * dozens of lines.
 */
export async function listStockTakeHistory(
  limit = 10,
): Promise<StockTakeHistoryEntry[]> {
  const rows = await prisma.auditLog.findMany({
    where: { tableName: "stock_takes" },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { user: { select: { name: true } } },
  });

  return rows.map((r) => {
    const changes = (r.changes ?? {}) as {
      note?: string;
      lineCount?: number;
      adjustedCount?: number;
      lines?: Array<{
        productId?: string;
        sku?: string;
        name?: string;
        system?: number;
        counted?: number;
        countedCartons?: number;
        countedLooseUnits?: number;
        variance?: number;
      }>;
    };
    const lines: StockTakeHistoryLine[] = (changes.lines ?? []).map((l) => ({
      productId: l.productId ?? "",
      sku: l.sku ?? "",
      name: l.name ?? "",
      system: l.system ?? 0,
      counted: l.counted ?? 0,
      countedCartons: l.countedCartons ?? 0,
      countedLooseUnits: l.countedLooseUnits ?? 0,
      variance: l.variance ?? 0,
    }));
    return {
      id: r.id,
      createdAt: r.createdAt,
      userName: r.user?.name ?? null,
      note: changes.note ?? "",
      lineCount: changes.lineCount ?? lines.length,
      adjustedCount:
        changes.adjustedCount ?? lines.filter((l) => l.variance !== 0).length,
      lines,
    };
  });
}
