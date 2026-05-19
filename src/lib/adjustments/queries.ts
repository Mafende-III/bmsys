import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ADJUSTMENT_REASONS, type AdjustmentReason } from "./schema";

export type AdjustmentFilters = {
  productId?: string;
  reason?: AdjustmentReason | "all";
};

export async function listAdjustments(filters: AdjustmentFilters = {}) {
  const where: Prisma.AdjustmentWhereInput = {};
  if (filters.productId) where.productId = filters.productId;
  if (filters.reason && filters.reason !== "all" &&
      ADJUSTMENT_REASONS.includes(filters.reason as AdjustmentReason)) {
    where.reason = filters.reason;
  }

  return prisma.adjustment.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      product: { select: { sku: true, name: true, unitsPerCarton: true } },
      user: { select: { name: true } },
    },
  });
}
