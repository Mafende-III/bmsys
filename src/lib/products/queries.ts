import type { Prisma, Product } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type ProductFilters = {
  search?: string;
  categoryId?: string;
  active?: boolean | "all";
};

export type ProductWithStock = Product & {
  totalUnits: number;
  openedUnits: number;
  sealedCartons: number;
  categoryName: string | null;
  categoryIconEmoji: string | null;
};

/**
 * List products with derived stock metrics (3 batched queries, not N+1).
 * Joins Category so the list page can show the category name + icon.
 */
export async function getProductsWithStock(
  filters: ProductFilters = {},
): Promise<ProductWithStock[]> {
  const where: Prisma.ProductWhereInput = {};

  if (filters.active !== "all") {
    where.active = filters.active ?? true;
  }

  if (filters.categoryId) {
    where.categoryId = filters.categoryId;
  }

  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: "insensitive" } },
      { sku: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  const products = await prisma.product.findMany({
    where,
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: {
      category: { select: { name: true, iconEmoji: true } },
    },
  });

  if (products.length === 0) return [];

  const ids = products.map((p) => p.id);

  const [stockSums, openedSums] = await Promise.all([
    prisma.stockMove.groupBy({
      by: ["productId"],
      where: { productId: { in: ids } },
      _sum: { qtyUnits: true },
    }),
    prisma.carton.groupBy({
      by: ["productId"],
      where: { productId: { in: ids }, state: "OPENED" },
      _sum: { unitsRemaining: true },
    }),
  ]);

  const totalById = new Map(stockSums.map((s) => [s.productId, s._sum.qtyUnits ?? 0]));
  const openedById = new Map(
    openedSums.map((s) => [s.productId, s._sum.unitsRemaining ?? 0]),
  );

  return products.map((p) => {
    const totalUnits = totalById.get(p.id) ?? 0;
    const openedUnits = openedById.get(p.id) ?? 0;
    const sealedUnits = totalUnits - openedUnits;
    const sealedCartons =
      sealedUnits > 0 ? Math.floor(sealedUnits / p.unitsPerCarton) : 0;
    const { category, ...rest } = p;
    return {
      ...rest,
      totalUnits,
      openedUnits,
      sealedCartons,
      categoryName: category?.name ?? null,
      categoryIconEmoji: category?.iconEmoji ?? null,
    };
  });
}

export async function getProduct(id: string) {
  return prisma.product.findUnique({ where: { id } });
}

export async function getRecentStockMoves(productId: string, limit = 20) {
  return prisma.stockMove.findMany({
    where: { productId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { user: { select: { name: true } } },
  });
}

/**
 * Returns the active Category list, ordered by sortOrder then name —
 * used to populate the category dropdown on the product form.
 */
export async function getCategoriesForPicker() {
  return prisma.category.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, iconKey: true, iconEmoji: true },
  });
}
