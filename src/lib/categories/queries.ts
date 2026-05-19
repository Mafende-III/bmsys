import { prisma } from "@/lib/prisma";

export async function listCategoriesWithCounts() {
  const cats = await prisma.category.findMany({
    orderBy: [{ active: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
    include: {
      _count: {
        select: { products: { where: { active: true } } },
      },
    },
  });
  return cats.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    iconEmoji: c.iconEmoji,
    sortOrder: c.sortOrder,
    active: c.active,
    productCount: c._count.products,
  }));
}

export async function getCategory(id: string) {
  return prisma.category.findUnique({ where: { id } });
}
