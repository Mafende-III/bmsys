import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createSaleOp } from "@/lib/sales/operations";

const prisma = new PrismaClient({
  datasourceUrl: process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL,
});

let ownerId: string;
let sellerId: string;
let retailId: string;
let wholesaleId: string;
let productAId: string; // 12/carton, sellable both ways
let productBId: string; // 24/carton, sellable both ways
const TEST_OWNER_PHONE = "+250000999007";
const TEST_SELLER_PHONE = "+250000999008";

beforeAll(async () => {
  await prisma.$transaction([
    prisma.idempotencyKey.deleteMany({}),
    prisma.auditLog.deleteMany({}),
    prisma.userChannel.deleteMany({}),
    prisma.saleLine.deleteMany({}),
    prisma.sale.deleteMany({}),
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
  ]);
});

beforeEach(async () => {
  await prisma.$transaction([
    prisma.idempotencyKey.deleteMany({}),
    prisma.auditLog.deleteMany({}),
    prisma.userChannel.deleteMany({}),
    prisma.saleLine.deleteMany({}),
    prisma.sale.deleteMany({}),
    prisma.purchaseLine.deleteMany({}),
    prisma.purchase.deleteMany({}),
    prisma.adjustment.deleteMany({}),
    prisma.stockMove.deleteMany({}),
    prisma.carton.deleteMany({}),
    prisma.channelPriceOverride.deleteMany({}),
    prisma.product.deleteMany({}),
    prisma.supplier.deleteMany({}),
    prisma.channel.deleteMany({}),
    prisma.user.deleteMany({}),
  ]);

  const owner = await prisma.user.create({
    data: {
      name: "Sales Test Owner",
      phone: TEST_OWNER_PHONE,
      pinHash: "x",
      role: "OWNER",
    },
  });
  ownerId = owner.id;

  const seller = await prisma.user.create({
    data: {
      name: "Sales Test Seller",
      phone: TEST_SELLER_PHONE,
      pinHash: "x",
      role: "SELLER",
    },
  });
  sellerId = seller.id;

  const [retail, wholesale] = await Promise.all([
    prisma.channel.create({ data: { name: "Retail", slug: "retail" } }),
    prisma.channel.create({ data: { name: "Wholesale", slug: "wholesale" } }),
  ]);
  retailId = retail.id;
  wholesaleId = wholesale.id;

  // Seller is only allowed on retail
  await prisma.userChannel.create({
    data: { userId: sellerId, channelId: retailId },
  });

  const [a, b] = await Promise.all([
    prisma.product.create({
      data: {
        sku: "SALE-A",
        name: "Test Product A",
        unitsPerCarton: 12,
        costPerCarton: 4500,
        unitPrice: 600,
        cartonPrice: 6800,
      },
    }),
    prisma.product.create({
      data: {
        sku: "SALE-B",
        name: "Test Product B",
        unitsPerCarton: 24,
        costPerCarton: 7200,
        unitPrice: 400,
        cartonPrice: 8400,
      },
    }),
  ]);
  productAId = a.id;
  productBId = b.id;

  // Seed stock: 2 cartons (24 units) of A, 3 cartons (72 units) of B,
  // recorded via a single stock_move per product.
  await prisma.stockMove.createMany({
    data: [
      {
        productId: productAId,
        qtyUnits: 24,
        reason: "PURCHASE",
        userId: ownerId,
      },
      {
        productId: productBId,
        qtyUnits: 72,
        reason: "PURCHASE",
        userId: ownerId,
      },
    ],
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});

const baseInput = (overrides: Partial<{ channelId: string; items: any[] }> = {}) => ({
  channelId: overrides.channelId ?? retailId,
  paymentMethod: "CASH" as const,
  paymentReference: undefined,
  items: overrides.items ?? [
    { productId: productAId, saleUnit: "UNIT" as const, qty: 3 },
  ],
});

describe("createSaleOp", () => {
  it("retail UNIT sale auto-opens a carton and writes one stock_move", async () => {
    const r = await createSaleOp(ownerId, "s-1", baseInput());
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const sale = await prisma.sale.findUniqueOrThrow({
      where: { id: r.data.saleId },
      include: { lines: true },
    });
    expect(sale.total).toBe(1800); // 3 * 600
    expect(sale.lines).toHaveLength(1);
    expect(sale.lines[0]?.cartonId).not.toBeNull();

    const cartons = await prisma.carton.findMany({
      where: { productId: productAId },
    });
    expect(cartons).toHaveLength(1);
    expect(cartons[0]?.state).toBe("OPENED");
    expect(cartons[0]?.unitsRemaining).toBe(9); // 12 - 3

    const sum = await prisma.stockMove.aggregate({
      where: { productId: productAId, reason: "SALE_UNIT" },
      _sum: { qtyUnits: true },
    });
    expect(sum._sum.qtyUnits).toBe(-3);

    const openMove = await prisma.stockMove.findFirst({
      where: { productId: productAId, reason: "CARTON_OPEN" },
    });
    expect(openMove).not.toBeNull();
  });

  it("subsequent UNIT sale uses the existing OPENED carton", async () => {
    const r1 = await createSaleOp(ownerId, "s-2a", baseInput());
    expect(r1.ok).toBe(true);

    const r2 = await createSaleOp(ownerId, "s-2b", baseInput());
    expect(r2.ok).toBe(true);

    const cartons = await prisma.carton.findMany({
      where: { productId: productAId },
    });
    expect(cartons).toHaveLength(1); // not two
    expect(cartons[0]?.unitsRemaining).toBe(6); // 12 - 3 - 3
  });

  it("sets carton to EMPTY when the open carton runs out", async () => {
    const r = await createSaleOp(
      ownerId,
      "s-3",
      baseInput({
        items: [{ productId: productAId, saleUnit: "UNIT", qty: 12 }],
      }),
    );
    expect(r.ok).toBe(true);
    const carton = await prisma.carton.findFirstOrThrow({
      where: { productId: productAId },
    });
    expect(carton.state).toBe("EMPTY");
    expect(carton.unitsRemaining).toBe(0);
  });

  it("CARTON sale decrements sealed cartons via stock_move", async () => {
    const r = await createSaleOp(
      ownerId,
      "s-4",
      baseInput({
        items: [{ productId: productBId, saleUnit: "CARTON", qty: 2 }],
      }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.total).toBe(16800); // 2 * 8400

    const sum = await prisma.stockMove.aggregate({
      where: { productId: productBId },
      _sum: { qtyUnits: true },
    });
    // 72 received - 2*24 sold = 24 remaining
    expect(sum._sum.qtyUnits).toBe(24);

    const cartonRows = await prisma.carton.findMany({
      where: { productId: productBId },
    });
    expect(cartonRows).toHaveLength(0); // no cartons opened
  });

  it("refuses UNIT line with qty > unitsPerCarton", async () => {
    const r = await createSaleOp(
      ownerId,
      "s-5",
      baseInput({
        items: [{ productId: productAId, saleUnit: "UNIT", qty: 13 }],
      }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/at most 12 unit/i);
  });

  it("refuses CARTON sale when sealed stock is insufficient", async () => {
    const r = await createSaleOp(
      ownerId,
      "s-6",
      baseInput({
        items: [{ productId: productAId, saleUnit: "CARTON", qty: 3 }], // only 2 available
      }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/only.*sealed carton/i);
  });

  it("refuses SELLER on a channel they aren't allowed on", async () => {
    const r = await createSaleOp(
      sellerId,
      "s-7",
      baseInput({ channelId: wholesaleId }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/not authorized/i);
  });

  it("allows SELLER on their assigned channel", async () => {
    const r = await createSaleOp(
      sellerId,
      "s-8",
      baseInput({ channelId: retailId }),
    );
    expect(r.ok).toBe(true);
  });

  it("uses channel price override when present", async () => {
    await prisma.channelPriceOverride.create({
      data: {
        productId: productAId,
        channelId: retailId,
        unitPrice: 750, // override 600 -> 750
      },
    });

    const r = await createSaleOp(
      ownerId,
      "s-9",
      baseInput({
        items: [{ productId: productAId, saleUnit: "UNIT", qty: 2 }],
      }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.total).toBe(1500); // 2 * 750
  });

  it("multi-line cart writes one sale + N lines + N stock_moves", async () => {
    const r = await createSaleOp(
      ownerId,
      "s-10",
      baseInput({
        items: [
          { productId: productAId, saleUnit: "UNIT", qty: 2 },
          { productId: productBId, saleUnit: "CARTON", qty: 1 },
        ],
      }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.total).toBe(2 * 600 + 8400);

    const lines = await prisma.saleLine.findMany({
      where: { saleId: r.data.saleId },
    });
    expect(lines).toHaveLength(2);

    const sumA = await prisma.stockMove.aggregate({
      where: { productId: productAId, reason: { not: "PURCHASE" } },
      _sum: { qtyUnits: true },
    });
    const sumB = await prisma.stockMove.aggregate({
      where: { productId: productBId, reason: { not: "PURCHASE" } },
      _sum: { qtyUnits: true },
    });
    // A: -2 (SALE_UNIT) + 0 (CARTON_OPEN)
    // B: -24 (SALE_CARTON)
    expect(sumA._sum.qtyUnits).toBe(-2);
    expect(sumB._sum.qtyUnits).toBe(-24);
  });

  it("is idempotent on key reuse (same sale returned, no double-write)", async () => {
    const r1 = await createSaleOp(ownerId, "s-11", baseInput());
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;

    const r2 = await createSaleOp(ownerId, "s-11", baseInput());
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;
    expect(r2.data.saleId).toBe(r1.data.saleId);

    expect(await prisma.sale.count()).toBe(1);
    expect(await prisma.saleLine.count()).toBe(1);
    expect(
      await prisma.stockMove.count({ where: { reason: "SALE_UNIT" } }),
    ).toBe(1);
  });

  it("refuses sale on archived product", async () => {
    await prisma.product.update({
      where: { id: productAId },
      data: { active: false },
    });

    const r = await createSaleOp(ownerId, "s-12", baseInput());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/archived/i);
  });

  it("refuses UNIT sale on product with sellableAsUnit=false", async () => {
    await prisma.product.update({
      where: { id: productAId },
      data: { sellableAsUnit: false },
    });

    const r = await createSaleOp(ownerId, "s-13", baseInput());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/cannot be sold as unit/i);
  });
});
