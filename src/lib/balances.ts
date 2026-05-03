/**
 * Stock balance functions.
 *
 * CRITICAL RULE: stock for a product is ALWAYS computed from stock_moves.
 * No code anywhere should read a "stock_count" column. There is no such column.
 */

import { prisma } from "@/lib/prisma";

/**
 * Total units in stock for a product, computed from the immutable ledger.
 */
export async function getStockUnits(productId: string): Promise<number> {
  const result = await prisma.stockMove.aggregate({
    where: { productId },
    _sum: { qtyUnits: true },
  });
  return result._sum.qtyUnits ?? 0;
}

/**
 * Sealed cartons available for a product = total stock units, minus units
 * sitting in OPENED cartons, divided by units_per_carton.
 *
 * Returns whole sealed cartons; remainder lives in opened cartons.
 */
export async function getSealedCartonCount(productId: string): Promise<number> {
  const product = await prisma.product.findUniqueOrThrow({
    where: { id: productId },
    select: { unitsPerCarton: true },
  });

  const total = await getStockUnits(productId);

  const openedAgg = await prisma.carton.aggregate({
    where: { productId, state: "OPENED" },
    _sum: { unitsRemaining: true },
  });
  const openedUnits = openedAgg._sum.unitsRemaining ?? 0;

  const sealedUnits = total - openedUnits;
  if (sealedUnits < 0) {
    throw new Error(
      `Stock invariant violated for product ${productId}: opened cartons hold more units than total ledger.`,
    );
  }
  return Math.floor(sealedUnits / product.unitsPerCarton);
}

/**
 * Customer credit balance. Positive = customer owes us.
 */
export async function getCreditBalance(customerId: string): Promise<number> {
  const result = await prisma.creditMovement.aggregate({
    where: { customerId },
    _sum: { amount: true },
  });
  return result._sum.amount ?? 0;
}

/**
 * Customer loyalty points balance.
 */
export async function getLoyaltyPoints(customerId: string): Promise<number> {
  const result = await prisma.loyaltyMovement.aggregate({
    where: { customerId },
    _sum: { points: true },
  });
  return result._sum.points ?? 0;
}
