import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createSaleOp } from "@/lib/sales/operations";
import {
  createCouponOp,
  previewCouponOp,
  revokeCouponOp,
} from "@/lib/coupons/operations";

const prisma = new PrismaClient({
  datasourceUrl: process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL,
});

let ownerId: string;
let sellerId: string;
let channelId: string;
let productAId: string; // unit price 600, cost/carton 4500, units/carton 12 → cost/unit 375
let productBId: string; // unit price 1000, cost/carton 9000, units/carton 12 → cost/unit 750
const TEST_OWNER_PHONE = "+250000999050";
const TEST_SELLER_PHONE = "+250000999051";

const fullWipe = () =>
  prisma.$transaction([
    prisma.idempotencyKey.deleteMany({}),
    prisma.auditLog.deleteMany({}),
    prisma.cashSession.deleteMany({}),
    prisma.userChannel.deleteMany({}),
    prisma.saleLine.deleteMany({}),
    prisma.sale.deleteMany({}),
    prisma.coupon.deleteMany({}),
    prisma.purchaseLine.deleteMany({}),
    prisma.purchase.deleteMany({}),
    prisma.adjustment.deleteMany({}),
    prisma.stockMove.deleteMany({}),
    prisma.carton.deleteMany({}),
    prisma.channelPriceOverride.deleteMany({}),
    prisma.product.deleteMany({}),
    prisma.supplier.deleteMany({}),
    prisma.customer.deleteMany({}),
    prisma.channel.deleteMany({}),
    prisma.user.deleteMany({}),
    prisma.settings.deleteMany({}),
  ]);

beforeAll(fullWipe);

beforeEach(async () => {
  await fullWipe();

  const owner = await prisma.user.create({
    data: {
      name: "Coupon Test Owner",
      phone: TEST_OWNER_PHONE,
      pinHash: "x",
      role: "OWNER",
    },
  });
  ownerId = owner.id;

  const seller = await prisma.user.create({
    data: {
      name: "Coupon Test Seller",
      phone: TEST_SELLER_PHONE,
      pinHash: "x",
      role: "SELLER",
    },
  });
  sellerId = seller.id;

  const channel = await prisma.channel.create({
    data: { name: "Retail", slug: "retail" },
  });
  channelId = channel.id;
  await prisma.userChannel.create({
    data: { userId: sellerId, channelId },
  });

  const [a, b] = await Promise.all([
    prisma.product.create({
      data: {
        sku: "COUPON-A",
        name: "Coupon Test A",
        unitsPerCarton: 12,
        costPerCarton: 4500,
        unitPrice: 600,
        cartonPrice: 6800,
      },
    }),
    prisma.product.create({
      data: {
        sku: "COUPON-B",
        name: "Coupon Test B",
        unitsPerCarton: 12,
        // Cost 500/unit (6000/12); sells for 1000 → 100% margin so the
        // 30% floor leaves plenty of room for a coupon to absorb.
        costPerCarton: 6000,
        unitPrice: 1000,
        cartonPrice: 11000,
      },
    }),
  ]);
  productAId = a.id;
  productBId = b.id;

  // Seed enough sealed stock for any test
  await prisma.stockMove.createMany({
    data: [
      {
        productId: productAId,
        qtyUnits: 240,
        reason: "PURCHASE",
        userId: ownerId,
      },
      {
        productId: productBId,
        qtyUnits: 240,
        reason: "PURCHASE",
        userId: ownerId,
      },
    ],
  });

  // Open cash session for CASH sales
  await prisma.cashSession.create({
    data: {
      openedById: ownerId,
      openingFloat: 0,
    },
  });

  // 30% default floor — productA: cost 375, floor 488 → max disc 112
  await prisma.settings.create({
    data: { id: "default", defaultMinMarginBps: 3000 },
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("createCouponOp", () => {
  it("only OWNER can issue", async () => {
    const r = await createCouponOp(sellerId, {
      type: "PERCENT",
      value: 10,
      expiresInDays: 7,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/only the owner/i);
  });

  it("auto-generates a 6-char code by default", async () => {
    const r = await createCouponOp(ownerId, {
      type: "PERCENT",
      value: 10,
      expiresInDays: 7,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.code).toMatch(/^[A-Z2-9]{6}$/);
  });

  it("honours an owner-typed code", async () => {
    const r = await createCouponOp(ownerId, {
      code: "wholesale10",
      type: "PERCENT",
      value: 10,
      expiresInDays: 7,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.code).toBe("WHOLESALE10");
  });

  it("rejects a duplicate code", async () => {
    const r1 = await createCouponOp(ownerId, {
      code: "WHOLE10",
      type: "PERCENT",
      value: 10,
      expiresInDays: 7,
    });
    expect(r1.ok).toBe(true);
    const r2 = await createCouponOp(ownerId, {
      code: "WHOLE10",
      type: "PERCENT",
      value: 5,
      expiresInDays: 7,
    });
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.error).toMatch(/already in use/i);
  });
});

describe("createSaleOp with coupon redemption", () => {
  function baseItems() {
    return [
      { productId: productAId, saleUnit: "UNIT" as const, qty: 1 }, // 600
    ];
  }

  async function makeCoupon(extra: Partial<{
    code: string;
    type: "FIXED" | "PERCENT";
    value: number;
    productId: string | null;
    allowFloorOverride: boolean;
  }> = {}) {
    const r = await createCouponOp(ownerId, {
      code: extra.code ?? "TEST10",
      type: extra.type ?? "PERCENT",
      value: extra.value ?? 10,
      productId: extra.productId ?? null,
      expiresInDays: 7,
      allowFloorOverride: extra.allowFloorOverride ?? false,
    });
    if (!r.ok) throw new Error(r.error);
    return r.data;
  }

  it("PERCENT cart-wide: discount applied to line, audit captures code", async () => {
    const coupon = await makeCoupon({
      code: "PCT10",
      type: "PERCENT",
      value: 10,
    });
    const r = await createSaleOp(ownerId, "sale-1", {
      channelId,
      paymentMethod: "CASH",
      items: baseItems(),
      couponCode: coupon.code,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // 10% of 600 = 60 → final 540
    expect(r.data.total).toBe(540);

    const lines = await prisma.saleLine.findMany({
      where: { saleId: r.data.saleId },
    });
    expect(lines).toHaveLength(1);
    expect(lines[0]!.discountAmount).toBe(60);
    expect(lines[0]!.lineTotal).toBe(540);

    const sale = await prisma.sale.findUnique({
      where: { id: r.data.saleId },
    });
    expect(sale!.couponId).toBeTruthy();

    const updatedCoupon = await prisma.coupon.findUnique({
      where: { code: "PCT10" },
    });
    expect(updatedCoupon!.redeemedBySaleId).toBe(r.data.saleId);
    expect(updatedCoupon!.redeemedByUserId).toBe(ownerId);
    expect(updatedCoupon!.redeemedAt).toBeTruthy();
  });

  it("FIXED cart-wide distributes across multiple lines proportionally", async () => {
    const coupon = await makeCoupon({
      code: "OFF300",
      type: "FIXED",
      value: 300,
    });
    const r = await createSaleOp(ownerId, "sale-2", {
      channelId,
      paymentMethod: "CASH",
      items: [
        { productId: productAId, saleUnit: "UNIT", qty: 2 }, // 1200
        { productId: productBId, saleUnit: "UNIT", qty: 2 }, // 2000
      ],
      couponCode: coupon.code,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // gross = 3200, target = 300; A gets floor(300*1200/3200)=112, B gets 187,
    // leftover 1 goes to higher fractional part (B: 1200·300/3200=112.5 vs
    // 2000·300/3200=187.5 — tie → first eligible wins; B gets +1 → 188).
    const lines = await prisma.saleLine.findMany({
      where: { saleId: r.data.saleId },
      orderBy: { productId: "asc" },
    });
    const sumDisc = lines.reduce((s, l) => s + l.discountAmount, 0);
    expect(sumDisc).toBe(300);
    expect(r.data.total).toBe(3200 - 300);
  });

  it("PERCENT product-locked: only the matching line is discounted", async () => {
    const coupon = await makeCoupon({
      code: "ONA15",
      type: "PERCENT",
      value: 15,
      productId: productAId,
    });
    const r = await createSaleOp(ownerId, "sale-3", {
      channelId,
      paymentMethod: "CASH",
      items: [
        { productId: productAId, saleUnit: "UNIT", qty: 1 }, // 600
        { productId: productBId, saleUnit: "UNIT", qty: 1 }, // 1000
      ],
      couponCode: coupon.code,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const lines = await prisma.saleLine.findMany({
      where: { saleId: r.data.saleId },
    });
    const lineA = lines.find((l) => l.productId === productAId)!;
    const lineB = lines.find((l) => l.productId === productBId)!;
    expect(lineA.discountAmount).toBe(90); // 15% of 600
    expect(lineB.discountAmount).toBe(0);
  });

  it("rejects a product-locked coupon when the cart has no matching product", async () => {
    const coupon = await makeCoupon({
      code: "ONLYB",
      type: "PERCENT",
      value: 10,
      productId: productBId,
    });
    const r = await createSaleOp(ownerId, "sale-4", {
      channelId,
      paymentMethod: "CASH",
      items: baseItems(), // only A
      couponCode: coupon.code,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/only applies to/i);
  });

  it("rejects an expired coupon", async () => {
    const c = await prisma.coupon.create({
      data: {
        code: "EXPIRED",
        type: "PERCENT",
        value: 10,
        expiresAt: new Date(Date.now() - 1000),
        createdByUserId: ownerId,
      },
    });
    const r = await createSaleOp(ownerId, "sale-5", {
      channelId,
      paymentMethod: "CASH",
      items: baseItems(),
      couponCode: c.code,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/expired/i);
  });

  it("rejects a revoked coupon", async () => {
    const c = await makeCoupon({ code: "REVOKED" });
    await revokeCouponOp(ownerId, c.id);
    const r = await createSaleOp(ownerId, "sale-6", {
      channelId,
      paymentMethod: "CASH",
      items: baseItems(),
      couponCode: c.code,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/revoked/i);
  });

  it("rejects a redeemed coupon on the second attempt", async () => {
    const c = await makeCoupon({ code: "ONESHOT" });
    const r1 = await createSaleOp(ownerId, "sale-7a", {
      channelId,
      paymentMethod: "CASH",
      items: baseItems(),
      couponCode: c.code,
    });
    expect(r1.ok).toBe(true);
    const r2 = await createSaleOp(ownerId, "sale-7b", {
      channelId,
      paymentMethod: "CASH",
      items: baseItems(),
      couponCode: c.code,
    });
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.error).toMatch(/already been used/i);
  });

  it("rejects a coupon that would breach the floor (no override)", async () => {
    // 30% off 600-RWF Water with cost-per-unit 375 → 180 off → 420 < floor 488
    const c = await makeCoupon({ code: "BIG30", value: 30 });
    const r = await createSaleOp(ownerId, "sale-8", {
      channelId,
      paymentMethod: "CASH",
      items: baseItems(),
      couponCode: c.code,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/margin floor/i);
  });

  it("allows a floor-breaking coupon when allowFloorOverride is set", async () => {
    const c = await makeCoupon({
      code: "OVERRIDE30",
      value: 30,
      allowFloorOverride: true,
    });
    const r = await createSaleOp(ownerId, "sale-9", {
      channelId,
      paymentMethod: "CASH",
      items: baseItems(),
      couponCode: c.code,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.total).toBe(420);

    const lines = await prisma.saleLine.findMany({
      where: { saleId: r.data.saleId },
    });
    expect(lines[0]!.floorOverride).toBe(true);
  });
});

describe("previewCouponOp", () => {
  it("returns a per-line discount preview for the cart", async () => {
    await createCouponOp(ownerId, {
      code: "PREV15",
      type: "PERCENT",
      value: 15,
      expiresInDays: 7,
    });
    const r = await previewCouponOp(
      "PREV15",
      [{ productId: productAId, saleUnit: "UNIT", qty: 1 }],
      channelId,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.discountTotal).toBe(90);
    expect(r.newTotal).toBe(510);
    expect(r.perLine[0]!.discount).toBe(90);
  });

  it("returns an error preview for an unknown code (no throw)", async () => {
    const r = await previewCouponOp(
      "DOESNOTEXIST",
      [{ productId: productAId, saleUnit: "UNIT", qty: 1 }],
      channelId,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/not found/i);
  });
});
