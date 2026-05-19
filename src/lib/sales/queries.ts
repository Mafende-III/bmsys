import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type SellableProduct = {
  id: string;
  sku: string;
  name: string;
  category: string | null;
  unitsPerCarton: number;
  sellableAsUnit: boolean;
  sellableAsCarton: boolean;
  unitPrice: number;        // effective for the given channel
  cartonPrice: number;      // effective for the given channel
  totalUnits: number;       // ledger sum
  openedUnits: number;      // sum of OPENED carton units_remaining
  sealedCartons: number;    // floor((total - opened) / unitsPerCarton)
};

/**
 * Products eligible for selling on the given channel:
 * - active
 * - has at least some stock OR can still be opened (we still show stock=0 so
 *   the operator sees the icon and gets a clear "out of stock" message)
 * Returns each product with its effective prices for `channelId`.
 */
export async function listProductsForChannel(
  channelId: string,
  filter?: { category?: string },
): Promise<SellableProduct[]> {
  const where: Prisma.ProductWhereInput = { active: true };
  if (filter?.category) {
    where.category = filter.category;
  }

  const products = await prisma.product.findMany({
    where,
    orderBy: { name: "asc" },
    include: {
      channelPriceOverrides: { where: { channelId } },
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
    const sealedUnits = Math.max(0, totalUnits - openedUnits);
    const sealedCartons = Math.floor(sealedUnits / p.unitsPerCarton);
    const override = p.channelPriceOverrides[0];
    return {
      id: p.id,
      sku: p.sku,
      name: p.name,
      category: p.category,
      unitsPerCarton: p.unitsPerCarton,
      sellableAsUnit: p.sellableAsUnit,
      sellableAsCarton: p.sellableAsCarton,
      unitPrice: override?.unitPrice ?? p.unitPrice,
      cartonPrice: override?.cartonPrice ?? p.cartonPrice,
      totalUnits,
      openedUnits,
      sealedCartons,
    };
  });
}

/**
 * Distinct categories among active products that have any stock.
 * Used to render the category grid on /sell.
 */
export async function listSellableCategories(
  channelId: string,
): Promise<Array<{ name: string; productCount: number }>> {
  const products = await listProductsForChannel(channelId);
  const byCategory = new Map<string, number>();
  for (const p of products) {
    const cat = p.category ?? "Uncategorised";
    byCategory.set(cat, (byCategory.get(cat) ?? 0) + 1);
  }
  return Array.from(byCategory.entries())
    .map(([name, productCount]) => ({ name, productCount }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function categorySlug(category: string): string {
  return category
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function findCategoryBySlug(
  channelId: string,
  slug: string,
): Promise<string | null> {
  const cats = await listSellableCategories(channelId);
  return cats.find((c) => categorySlug(c.name) === slug)?.name ?? null;
}

const CATEGORY_ICONS: Record<string, string> = {
  water: "💧",
  beer: "🍺",
  soda: "🥤",
  fanta: "🥤",
  juice: "🧃",
  wine: "🍷",
  spirits: "🥃",
  whisky: "🥃",
  snacks: "🍿",
  food: "🍪",
  bread: "🍞",
  uncategorised: "📦",
};

export function categoryIcon(category: string): string {
  return CATEGORY_ICONS[category.toLowerCase().trim()] ?? "📦";
}
