import { prisma } from "@/lib/prisma";

export type StockTakeRow = {
  productId: string;
  sku: string;
  name: string;
  systemUnits: number;
};

/**
 * Every active product with its current system stock derived from
 * StockMove. Used by the /stock-take form to seed each line.
 * Sorted by SKU so the printed sheet matches the order on screen.
 */
export async function listStockTakeRows(): Promise<StockTakeRow[]> {
  const products = await prisma.product.findMany({
    where: { active: true },
    orderBy: { sku: "asc" },
    select: { id: true, sku: true, name: true },
  });

  if (products.length === 0) return [];

  const sums = await prisma.stockMove.groupBy({
    by: ["productId"],
    where: { productId: { in: products.map((p) => p.id) } },
    _sum: { qtyUnits: true },
  });
  const sumByProduct = new Map<string, number>();
  for (const s of sums) {
    sumByProduct.set(s.productId, s._sum.qtyUnits ?? 0);
  }

  return products.map((p) => ({
    productId: p.id,
    sku: p.sku,
    name: p.name,
    systemUnits: sumByProduct.get(p.id) ?? 0,
  }));
}
