import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type SellableProduct = {
  id: string;
  sku: string;
  name: string;
  categoryId: string | null;
  categoryName: string | null;
  categorySlug: string | null;
  iconKey: string | null;       // resolved: product.iconKey ?? category.iconKey
  iconEmoji: string;            // resolved: product.iconEmoji ?? category.iconEmoji ?? 📦
  unitsPerCarton: number;
  sellableAsUnit: boolean;
  sellableAsCarton: boolean;
  unitPrice: number;            // effective for the given channel
  cartonPrice: number;          // effective for the given channel
  totalUnits: number;
  openedUnits: number;
  sealedCartons: number;
};

const FALLBACK_ICON = "📦";

/**
 * Products eligible for selling on the given channel. Joins Category
 * for icon resolution — product.iconKey/iconEmoji override the
 * category-level values.
 */
export async function listProductsForChannel(
  channelId: string,
  filter?: { categoryId?: string | null },
): Promise<SellableProduct[]> {
  const where: Prisma.ProductWhereInput = { active: true };
  if (filter && "categoryId" in filter) {
    where.categoryId = filter.categoryId; // null => uncategorised products
  }

  const products = await prisma.product.findMany({
    where,
    orderBy: { name: "asc" },
    include: {
      channelPriceOverrides: { where: { channelId } },
      category: {
        select: { name: true, slug: true, iconKey: true, iconEmoji: true },
      },
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
      categoryId: p.categoryId,
      categoryName: p.category?.name ?? null,
      categorySlug: p.category?.slug ?? null,
      iconKey: p.iconKey ?? p.category?.iconKey ?? null,
      iconEmoji:
        p.iconEmoji ?? p.category?.iconEmoji ?? FALLBACK_ICON,
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

export type SellableCategory = {
  id: string | null;            // null = synthetic Uncategorised bucket
  name: string;
  slug: string;
  iconKey: string | null;
  iconEmoji: string;
  productCount: number;
};

/**
 * Categories shown on the /sell home grid: active Category rows that
 * have at least one active product, plus a synthetic "Uncategorised"
 * bucket if any active products lack a category.
 */
export async function listSellableCategories(
  _channelId: string,
): Promise<SellableCategory[]> {
  const [cats, uncategorisedCount] = await Promise.all([
    prisma.category.findMany({
      where: {
        active: true,
        products: { some: { active: true } },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        _count: { select: { products: { where: { active: true } } } },
      },
    }),
    prisma.product.count({ where: { active: true, categoryId: null } }),
  ]);

  const result: SellableCategory[] = cats.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    iconKey: c.iconKey,
    iconEmoji: c.iconEmoji,
    productCount: c._count.products,
  }));

  if (uncategorisedCount > 0) {
    result.push({
      id: null,
      name: "Uncategorised",
      slug: "uncategorised",
      iconKey: null,
      iconEmoji: FALLBACK_ICON,
      productCount: uncategorisedCount,
    });
  }

  return result;
}

/**
 * Resolve a category slug to the matching category (or null for the
 * synthetic uncategorised bucket).
 */
export async function findCategoryBySlug(slug: string) {
  if (slug === "uncategorised") {
    return {
      id: null,
      name: "Uncategorised",
      slug,
      iconKey: null,
      iconEmoji: FALLBACK_ICON,
    };
  }
  const cat = await prisma.category.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      iconKey: true,
      iconEmoji: true,
    },
  });
  return cat;
}
