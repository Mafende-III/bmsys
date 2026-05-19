import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type PurchaseStatus = "DRAFT" | "RECEIVED" | "CANCELLED" | "all";

export async function listPurchases(filters: { status?: PurchaseStatus } = {}) {
  const where: Prisma.PurchaseWhereInput = {};
  if (filters.status && filters.status !== "all") {
    where.status = filters.status;
  }

  return prisma.purchase.findMany({
    where,
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      date: true,
      status: true,
      totalCost: true,
      note: true,
      supplier: { select: { id: true, name: true } },
      user: { select: { name: true } },
      _count: { select: { lines: true } },
    },
  });
}

export async function getPurchaseWithLines(id: string) {
  return prisma.purchase.findUnique({
    where: { id },
    include: {
      supplier: true,
      user: { select: { name: true } },
      lines: {
        include: {
          product: {
            select: {
              id: true,
              sku: true,
              name: true,
              unitsPerCarton: true,
            },
          },
        },
        orderBy: { id: "asc" },
      },
    },
  });
}
