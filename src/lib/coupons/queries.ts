import type { Coupon, CouponType, Product, User } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type CouponStatus = "ACTIVE" | "REDEEMED" | "EXPIRED" | "REVOKED";

export type CouponRow = {
  id: string;
  code: string;
  type: CouponType;
  value: number;
  perUnit: boolean;
  productId: string | null;
  productName: string | null;
  productSku: string | null;
  expiresAt: Date;
  allowFloorOverride: boolean;
  notes: string | null;
  status: CouponStatus;
  redeemedAt: Date | null;
  redeemedBySaleId: string | null;
  redeemedByUserName: string | null;
  revokedAt: Date | null;
  createdByUserName: string;
  createdAt: Date;
};

function statusFromRow(
  c: Coupon & {
    product: Product | null;
    redeemedByUser: User | null;
    createdByUser: User;
  },
  now: Date,
): CouponStatus {
  if (c.revokedAt) return "REVOKED";
  if (c.redeemedBySaleId || c.redeemedAt) return "REDEEMED";
  if (c.expiresAt < now) return "EXPIRED";
  return "ACTIVE";
}

function project(
  c: Coupon & {
    product: Product | null;
    redeemedByUser: User | null;
    createdByUser: User;
  },
  now: Date,
): CouponRow {
  return {
    id: c.id,
    code: c.code,
    type: c.type,
    value: c.value,
    perUnit: c.perUnit,
    productId: c.productId,
    productName: c.product?.name ?? null,
    productSku: c.product?.sku ?? null,
    expiresAt: c.expiresAt,
    allowFloorOverride: c.allowFloorOverride,
    notes: c.notes,
    status: statusFromRow(c, now),
    redeemedAt: c.redeemedAt,
    redeemedBySaleId: c.redeemedBySaleId,
    redeemedByUserName: c.redeemedByUser?.name ?? null,
    revokedAt: c.revokedAt,
    createdByUserName: c.createdByUser.name,
    createdAt: c.createdAt,
  };
}

/**
 * Owner-facing list. Most recent first. Caller filters client-side
 * (the page renders Active / Redeemed / Expired / Revoked tabs).
 */
export async function listCoupons(limit = 100): Promise<CouponRow[]> {
  const now = new Date();
  const rows = await prisma.coupon.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      product: true,
      redeemedByUser: true,
      createdByUser: true,
    },
  });
  return rows.map((r) => project(r, now));
}

export async function getCouponById(id: string): Promise<CouponRow | null> {
  const c = await prisma.coupon.findUnique({
    where: { id },
    include: {
      product: true,
      redeemedByUser: true,
      createdByUser: true,
    },
  });
  return c ? project(c, new Date()) : null;
}
