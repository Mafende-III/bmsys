import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createSaleOp } from "@/lib/sales/operations";
import { maxAllowedLineDiscount } from "@/lib/sales/floor";

const prisma = new PrismaClient({
  datasourceUrl: process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL,
});

let ownerId: string;
let sellerId: string;
let channelId: string;
let productAId: string; // unitsPerCarton 1, cost 500, unitPrice 800
let productBId: string; // unitsPerCarton 12, cost 4800, unitPrice 600 (per unit), cartonPrice 6000

const TEST_OWNER_PHONE = "+250000888001";
const TEST_SELLER_PHONE = "+250000888002";

const fullWipe = () =>
  prisma.$transaction([
    prisma.idempotencyKey.deleteMany({}),
    prisma.auditLog.deleteMany({}),
    prisma.cashSession.deleteMany({}),
    prisma.saleLine.deleteMany({}),
    prisma.sale.deleteMany({}),
    prisma.purchaseLine.deleteMany({}),
    prisma.purchase.deleteMany({}),
    prisma.stockMove.deleteMany({}),
    prisma.carton.deleteMany({}),
    prisma.channelPriceOverride.deleteMany({}),
    prisma.product.deleteMany({}),
    prisma.userChannel.deleteMany({}),
    prisma.channel.deleteMany({}),
    prisma.settings.deleteMany({}),
    prisma.user.deleteMany({
      where: { phone: { in: [TEST_OWNER_PHONE, TEST_SELLER_PHONE] } },
    }),
  ]);

beforeAll(fullWipe);

beforeEach(async () => {
  await fullWipe();

  const owner = await prisma.user.create({
    data: {
      name: "Discount Test Owner",
      phone: TEST_OWNER_PHONE,
      pinHash: "x",
      role: "OWNER",
    },
  });
  ownerId = owner.id;

  const seller = await prisma.user.create({
    data: {
      name: "Discount Test Seller",
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
    data: { userId: sellerId, channelId: channel.id },
  });

  // Product A: simple — cost 500, sell 800. 40% margin floor lets us
  // discount down to 700 (cost × 1.4) — max discount 100 RWF/unit.
  const a = await prisma.product.create({
    data: {
      sku: "DISC-A",
      name: "Discount Test A",
      unitsPerCarton: 1,
      costPerCarton: 500,
      unitPrice: 800,
      cartonPrice: 800,
      minMarginBps: 4000, // 40% floor
    },
  });
  productAId = a.id;

  // Product B: carton-pack. UPC=12, costPerCarton=4800 (cost/unit=400),
  // unitPrice=600, cartonPrice=6000. 25% floor → carton floor = 6000
  // (4800×1.25), so cartons can't be discounted at all.
  const b = await prisma.product.create({
    data: {
      sku: "DISC-B",
      name: "Discount Test B",
      unitsPerCarton: 12,
      costPerCarton: 4800,
      unitPrice: 600,
      cartonPrice: 6000,
      minMarginBps: 2500, // 25% floor
    },
  });
  productBId = b.id;

  await prisma.stockMove.createMany({
    data: [
      { productId: productAId, qtyUnits: 24, reason: "PURCHASE", userId: ownerId },
      { productId: productBId, qtyUnits: 72, reason: "PURCHASE", userId: ownerId },
    ],
  });

  await prisma.cashSession.create({
    data: { openingFloat: 0, openedById: ownerId },
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("maxAllowedLineDiscount", () => {
  it("matches the spec example: cost 500, sell 800, 40% margin → max 100 RWF", () => {
    expect(
      maxAllowedLineDiscount({
        saleUnit: "UNIT",
        qty: 1,
        unitPrice: 800,
        costPerCarton: 500,
        unitsPerCarton: 1,
        marginBps: 4000,
      }),
    ).toBe(100);
  });

  it("scales with qty", () => {
    // 5 × 800 = 4000 gross. Floor 5 × 700 = 3500. Max discount = 500.
    expect(
      maxAllowedLineDiscount({
        saleUnit: "UNIT",
        qty: 5,
        unitPrice: 800,
        costPerCarton: 500,
        unitsPerCarton: 1,
        marginBps: 4000,
      }),
    ).toBe(500);
  });

  it("carton sales use carton cost directly", () => {
    // Carton sell 6000, cost 4800, 25% → floor 6000. Max discount 0.
    expect(
      maxAllowedLineDiscount({
        saleUnit: "CARTON",
        qty: 1,
        unitPrice: 6000,
        costPerCarton: 4800,
        unitsPerCarton: 12,
        marginBps: 2500,
      }),
    ).toBe(0);
  });

  it("returns 0 when sell price is already below the floor", () => {
    expect(
      maxAllowedLineDiscount({
        saleUnit: "UNIT",
        qty: 1,
        unitPrice: 600,
        costPerCarton: 500,
        unitsPerCarton: 1,
        marginBps: 4000,
      }),
    ).toBe(0);
  });

  it("ceils so a rounding penny never sneaks below the floor", () => {
    // cost 100, UPC 3, qty 1, unitPrice 50. raw floor = 100/3 ≈ 33.33,
    // ceil → 34. Max discount = 50 − 34 = 16.
    expect(
      maxAllowedLineDiscount({
        saleUnit: "UNIT",
        qty: 1,
        unitPrice: 50,
        costPerCarton: 100,
        unitsPerCarton: 3,
        marginBps: 0,
      }),
    ).toBe(16);
  });
});

describe("createSaleOp — per-line discount", () => {
  it("applies the discount to lineTotal and Sale.total, persists reason", async () => {
    const r = await createSaleOp(ownerId, "d-1", {
      channelId,
      paymentMethod: "CASH",
      items: [
        {
          productId: productAId,
          saleUnit: "UNIT",
          qty: 1,
          discountAmount: 100,
          discountReason: "Regular customer",
        },
      ],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const sale = await prisma.sale.findUniqueOrThrow({
      where: { id: r.data.saleId },
      include: { lines: true },
    });
    expect(sale.total).toBe(700);
    expect(sale.lines[0]?.discountAmount).toBe(100);
    expect(sale.lines[0]?.discountReason).toBe("Regular customer");
    expect(sale.lines[0]?.floorOverride).toBe(false);
    expect(sale.lines[0]?.lineTotal).toBe(700);

    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { tableName: "sales", recordId: sale.id },
    });
    expect(audit.category).toBe("SALE_DISCOUNT");
    const changes = audit.changes as Record<string, unknown>;
    expect(changes.discountTotal).toBe(100);
  });

  it("rejects a discount that breaches the per-product floor (no override)", async () => {
    const r = await createSaleOp(ownerId, "d-2", {
      channelId,
      paymentMethod: "CASH",
      items: [
        {
          productId: productAId,
          saleUnit: "UNIT",
          qty: 1,
          discountAmount: 150, // floor allows only 100
          discountReason: "Too generous",
        },
      ],
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toMatch(/margin floor/i);
  });

  it("owner can override the floor; audit captures it", async () => {
    const r = await createSaleOp(ownerId, "d-3", {
      channelId,
      paymentMethod: "CASH",
      items: [
        {
          productId: productAId,
          saleUnit: "UNIT",
          qty: 1,
          discountAmount: 200, // below floor
          discountReason: "Clearance, expiry tomorrow",
          floorOverride: true,
        },
      ],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const line = await prisma.saleLine.findFirstOrThrow({
      where: { saleId: r.data.saleId },
    });
    expect(line.floorOverride).toBe(true);
    expect(line.lineTotal).toBe(600);

    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { tableName: "sales", recordId: r.data.saleId },
    });
    const changes = audit.changes as Record<string, unknown>;
    expect(changes.floorOverrideApplied).toBe(true);
  });

  it("seller cannot override the floor — flag is silently dropped, sale fails", async () => {
    const r = await createSaleOp(sellerId, "d-4", {
      channelId,
      paymentMethod: "CASH",
      items: [
        {
          productId: productAId,
          saleUnit: "UNIT",
          qty: 1,
          discountAmount: 200,
          discountReason: "Trying to bypass",
          floorOverride: true,
        },
      ],
    });
    expect(r.ok).toBe(false);
  });

  it("falls back to Settings.defaultMinMarginBps when product margin is 0", async () => {
    // Reset product A's per-product floor; use a 50% shop default.
    await prisma.product.update({
      where: { id: productAId },
      data: { minMarginBps: 0 },
    });
    await prisma.settings.upsert({
      where: { id: "default" },
      update: { defaultMinMarginBps: 5000 },
      create: { id: "default", defaultMinMarginBps: 5000 },
    });
    // Floor 500 × 1.5 = 750 → max discount 50. 60 should fail.
    const r = await createSaleOp(ownerId, "d-5", {
      channelId,
      paymentMethod: "CASH",
      items: [
        {
          productId: productAId,
          saleUnit: "UNIT",
          qty: 1,
          discountAmount: 60,
          discountReason: "test",
        },
      ],
    });
    expect(r.ok).toBe(false);
  });

  it("rejects a discount larger than the line gross", async () => {
    const r = await createSaleOp(ownerId, "d-6", {
      channelId,
      paymentMethod: "CASH",
      items: [
        {
          productId: productAId,
          saleUnit: "UNIT",
          qty: 1,
          discountAmount: 900, // gross is 800
          discountReason: "negative price?",
          floorOverride: true,
        },
      ],
    });
    expect(r.ok).toBe(false);
  });

  it("rejects an applied discount with no reason", async () => {
    const r = await createSaleOp(ownerId, "d-7", {
      channelId,
      paymentMethod: "CASH",
      items: [
        {
          productId: productAId,
          saleUnit: "UNIT",
          qty: 1,
          discountAmount: 50,
        },
      ],
    });
    expect(r.ok).toBe(false);
  });

  it("zero discount is the no-op path and writes no SALE_DISCOUNT audit category", async () => {
    const r = await createSaleOp(ownerId, "d-8", {
      channelId,
      paymentMethod: "CASH",
      items: [
        {
          productId: productAId,
          saleUnit: "UNIT",
          qty: 1,
        },
      ],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { tableName: "sales", recordId: r.data.saleId },
    });
    expect(audit.category).toBeNull();
  });
});
