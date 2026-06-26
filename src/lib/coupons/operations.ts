import type { Prisma } from "@prisma/client";
import type { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { createCouponSchema } from "@/lib/sales/schema";
import { maxAllowedLineDiscount } from "@/lib/sales/floor";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function firstError(error: ZodError): string {
  return error.errors[0]?.message ?? "Invalid input";
}

function errorMessage(e: unknown, fallback: string): string {
  return e instanceof Error ? e.message : fallback;
}

/**
 * 6-character uppercase alphanumeric, with the visually ambiguous
 * 0/O/I/1 removed. ~30^6 = 729M combos → collisions are astronomical
 * at the volumes BMSys cares about, but we still retry on the unique
 * constraint just in case.
 */
function randomCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) {
    out += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
  }
  return out;
}

export async function createCouponOp(
  userId: string,
  raw: unknown,
): Promise<
  ActionResult<{ id: string; code: string; expiresAt: Date }>
> {
  const parsed = createCouponSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const input = parsed.data;

  try {
    // Only OWNERs can issue coupons. This is also enforced in the
    // route guard, but defence-in-depth.
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (user?.role !== "OWNER") {
      return { ok: false, error: "Only the owner can issue coupons" };
    }

    if (input.productId) {
      const product = await prisma.product.findUnique({
        where: { id: input.productId },
        select: { id: true, active: true },
      });
      if (!product) return { ok: false, error: "Product not found" };
      if (!product.active)
        return { ok: false, error: "Product is archived" };
    }

    const expiresAt = new Date(
      Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000,
    );

    // Try the owner's typed code first if any, otherwise generate.
    // On collision: regenerate (only when auto) or surface "code taken".
    const tryWithCode = async (code: string) => {
      return prisma.coupon.create({
        data: {
          code,
          type: input.type,
          value: input.value,
          productId: input.productId ?? null,
          expiresAt,
          allowFloorOverride: input.allowFloorOverride,
          notes: input.notes ?? null,
          createdByUserId: userId,
        },
        select: { id: true, code: true, expiresAt: true },
      });
    };

    if (input.code) {
      try {
        const created = await tryWithCode(input.code);
        return { ok: true, data: created };
      } catch (e: unknown) {
        if (
          e instanceof Error &&
          /unique/i.test(e.message) &&
          /code/i.test(e.message)
        ) {
          return {
            ok: false,
            error: `Code "${input.code}" is already in use — pick another`,
          };
        }
        throw e;
      }
    }

    // Auto-generate; retry up to 5 times on collision.
    let lastErr: unknown = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const created = await tryWithCode(randomCode());
        return { ok: true, data: created };
      } catch (e: unknown) {
        lastErr = e;
        if (
          e instanceof Error &&
          /unique/i.test(e.message) &&
          /code/i.test(e.message)
        ) {
          continue;
        }
        throw e;
      }
    }
    return {
      ok: false,
      error: errorMessage(lastErr, "Could not generate a unique coupon code"),
    };
  } catch (e: unknown) {
    return { ok: false, error: errorMessage(e, "Failed to create coupon") };
  }
}

export async function revokeCouponOp(
  userId: string,
  couponId: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (user?.role !== "OWNER") {
      return { ok: false, error: "Only the owner can revoke coupons" };
    }
    const c = await prisma.coupon.findUnique({ where: { id: couponId } });
    if (!c) return { ok: false, error: "Coupon not found" };
    if (c.redeemedAt) {
      return { ok: false, error: "Coupon was already redeemed" };
    }
    if (c.revokedAt) return { ok: true, data: { id: c.id } };
    await prisma.coupon.update({
      where: { id: couponId },
      data: { revokedAt: new Date() },
    });
    await prisma.auditLog.create({
      data: {
        tableName: "Coupon",
        recordId: couponId,
        action: "UPDATE",
        changes: { revokedAt: "now" } as Prisma.InputJsonValue,
        userId,
      },
    });
    return { ok: true, data: { id: couponId } };
  } catch (e: unknown) {
    return { ok: false, error: errorMessage(e, "Failed to revoke coupon") };
  }
}

export type CouponPreview =
  | {
      ok: true;
      code: string;
      productScope: { id: string; name: string } | null;
      discountTotal: number;
      perLine: Array<{
        productId: string;
        productName: string;
        gross: number;
        discount: number;
        final: number;
      }>;
      floorOverride: boolean;
      newTotal: number;
    }
  | { ok: false; error: string };

/**
 * Used by the checkout UI to preview a coupon before submission so the
 * customer can see the new total. Mirrors the math in createSaleOp but
 * doesn't touch stock or persist anything.
 */
export async function previewCouponOp(
  code: string,
  items: Array<{
    productId: string;
    saleUnit: "UNIT" | "CARTON";
    qty: number;
  }>,
  channelId: string,
): Promise<CouponPreview> {
  if (items.length === 0) {
    return { ok: false, error: "Cart is empty" };
  }
  const normalised = code.trim().toUpperCase();
  if (normalised === "") return { ok: false, error: "Type a coupon code" };

  const coupon = await prisma.coupon.findUnique({
    where: { code: normalised },
    include: { product: true },
  });
  if (!coupon) return { ok: false, error: `Coupon "${normalised}" not found` };
  if (coupon.revokedAt) return { ok: false, error: "Coupon was revoked" };
  if (coupon.redeemedAt || coupon.redeemedBySaleId) {
    return { ok: false, error: "Coupon already used" };
  }
  if (coupon.expiresAt < new Date()) {
    return { ok: false, error: "Coupon has expired" };
  }
  if (
    coupon.productId &&
    !items.some((i) => i.productId === coupon.productId)
  ) {
    return {
      ok: false,
      error: `Only applies to ${coupon.product?.name ?? "a specific product"}`,
    };
  }

  const settings = await prisma.settings.findUnique({
    where: { id: "default" },
    select: { defaultMinMarginBps: true },
  });
  const defaultMinMarginBps = settings?.defaultMinMarginBps ?? 0;

  const productIds = items.map((i) => i.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
  });
  const byId = new Map(products.map((p) => [p.id, p]));

  type Plan = {
    productId: string;
    productName: string;
    gross: number;
    maxAtFloor: number;
    marginBps: number;
    costPerCarton: number;
  };
  const plans: Plan[] = [];
  for (const it of items) {
    const p = byId.get(it.productId);
    if (!p) return { ok: false, error: "Unknown product in cart" };
    const override = await prisma.channelPriceOverride.findUnique({
      where: {
        productId_channelId: { productId: p.id, channelId },
      },
    });
    const unitPrice =
      it.saleUnit === "UNIT"
        ? (override?.unitPrice ?? p.unitPrice)
        : (override?.cartonPrice ?? p.cartonPrice);
    const gross = unitPrice * it.qty;
    const marginBps =
      p.minMarginBps > 0 ? p.minMarginBps : defaultMinMarginBps;
    const maxAtFloor = maxAllowedLineDiscount({
      saleUnit: it.saleUnit,
      qty: it.qty,
      unitPrice,
      costPerCarton: p.costPerCarton,
      unitsPerCarton: p.unitsPerCarton,
      marginBps,
    });
    plans.push({
      productId: p.id,
      productName: p.name,
      gross,
      maxAtFloor,
      marginBps,
      costPerCarton: p.costPerCarton,
    });
  }

  const discountByIndex = new Array<number>(plans.length).fill(0);
  if (coupon.type === "PERCENT") {
    for (let i = 0; i < plans.length; i++) {
      if (coupon.productId && plans[i]!.productId !== coupon.productId)
        continue;
      discountByIndex[i] = Math.floor((plans[i]!.gross * coupon.value) / 100);
    }
  } else {
    const eligibleIdx = plans
      .map((_, i) => i)
      .filter(
        (i) => !coupon.productId || plans[i]!.productId === coupon.productId,
      );
    const eligibleGross = eligibleIdx.reduce(
      (a, i) => a + plans[i]!.gross,
      0,
    );
    if (eligibleGross <= 0) {
      return { ok: false, error: "Cart total is zero — nothing to discount" };
    }
    const target = Math.min(coupon.value, eligibleGross);
    if (eligibleIdx.length === 1) {
      discountByIndex[eligibleIdx[0]!] = target;
    } else {
      const fracs: Array<{ i: number; frac: number }> = [];
      let assigned = 0;
      for (const i of eligibleIdx) {
        const exact = (target * plans[i]!.gross) / eligibleGross;
        const base = Math.floor(exact);
        discountByIndex[i] = base;
        assigned += base;
        fracs.push({ i, frac: exact - base });
      }
      let leftover = target - assigned;
      fracs.sort((a, b) => b.frac - a.frac);
      for (const { i } of fracs) {
        if (leftover <= 0) break;
        discountByIndex[i] = (discountByIndex[i] ?? 0) + 1;
        leftover -= 1;
      }
    }
  }

  let blockedByFloor = false;
  for (let i = 0; i < plans.length; i++) {
    if (discountByIndex[i]! > plans[i]!.maxAtFloor) {
      blockedByFloor = true;
      break;
    }
  }
  if (blockedByFloor && !coupon.allowFloorOverride) {
    return {
      ok: false,
      error: `Coupon would breach the margin floor on at least one line`,
    };
  }

  const perLine = plans.map((p, i) => ({
    productId: p.productId,
    productName: p.productName,
    gross: p.gross,
    discount: discountByIndex[i]!,
    final: p.gross - discountByIndex[i]!,
  }));
  const discountTotal = perLine.reduce((a, l) => a + l.discount, 0);
  const grossTotal = perLine.reduce((a, l) => a + l.gross, 0);
  return {
    ok: true,
    code: coupon.code,
    productScope: coupon.productId
      ? {
          id: coupon.productId,
          name: coupon.product?.name ?? "(unknown product)",
        }
      : null,
    discountTotal,
    perLine,
    floorOverride: blockedByFloor && coupon.allowFloorOverride,
    newTotal: grossTotal - discountTotal,
  };
}
