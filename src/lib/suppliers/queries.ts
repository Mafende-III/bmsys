import type { Prisma, Supplier } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type SupplierFilters = {
  search?: string;
};

export type SupplierWithCounts = Supplier & {
  purchaseCount: number;
  lastPurchaseAt: Date | null;
};

/**
 * List suppliers with two batched aggregates: total purchases + most
 * recent purchase date. Used on the list page so the operator can see
 * which suppliers are active without clicking in.
 */
export async function listSuppliersWithCounts(
  filters: SupplierFilters = {},
): Promise<SupplierWithCounts[]> {
  const where: Prisma.SupplierWhereInput = {};

  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: "insensitive" } },
      { phone: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  const suppliers = await prisma.supplier.findMany({
    where,
    orderBy: { name: "asc" },
  });

  if (suppliers.length === 0) return [];

  const ids = suppliers.map((s) => s.id);

  const [counts, lasts] = await Promise.all([
    prisma.purchase.groupBy({
      by: ["supplierId"],
      where: { supplierId: { in: ids } },
      _count: { _all: true },
    }),
    prisma.purchase.groupBy({
      by: ["supplierId"],
      where: { supplierId: { in: ids } },
      _max: { date: true },
    }),
  ]);

  const countsById = new Map(counts.map((r) => [r.supplierId, r._count._all]));
  const lastsById = new Map(lasts.map((r) => [r.supplierId, r._max.date]));

  return suppliers.map((s) => ({
    ...s,
    purchaseCount: countsById.get(s.id) ?? 0,
    lastPurchaseAt: lastsById.get(s.id) ?? null,
  }));
}

export async function getSupplier(id: string) {
  return prisma.supplier.findUnique({ where: { id } });
}

export async function getRecentPurchases(supplierId: string, limit = 20) {
  return prisma.purchase.findMany({
    where: { supplierId },
    orderBy: { date: "desc" },
    take: limit,
    select: {
      id: true,
      date: true,
      status: true,
      totalCost: true,
      note: true,
    },
  });
}
