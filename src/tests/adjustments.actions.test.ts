import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createAdjustmentOp } from "@/lib/adjustments/operations";

const prisma = new PrismaClient({
  datasourceUrl: process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL,
});

let userId: string;
let productId: string;
const TEST_USER_PHONE = "+250000999010";

const fullWipe = () =>
  prisma.$transaction([
    prisma.idempotencyKey.deleteMany({}),
    prisma.auditLog.deleteMany({}),
    prisma.cashSession.deleteMany({}),
    prisma.adjustment.deleteMany({}),
    prisma.stockMove.deleteMany({}),
    prisma.carton.deleteMany({}),
    prisma.channelPriceOverride.deleteMany({}),
    prisma.product.deleteMany({}),
    prisma.category.deleteMany({}),
    prisma.channel.deleteMany({}),
    prisma.user.deleteMany({ where: { phone: TEST_USER_PHONE } }),
  ]);

beforeAll(fullWipe);

beforeEach(async () => {
  await fullWipe();

  const user = await prisma.user.create({
    data: {
      name: "Adj Test",
      phone: TEST_USER_PHONE,
      pinHash: "x",
      role: "OWNER",
    },
  });
  userId = user.id;

  const product = await prisma.product.create({
    data: {
      sku: "ADJ-A",
      name: "Adj Product",
      unitsPerCarton: 12,
      costPerCarton: 1000,
      unitPrice: 100,
      cartonPrice: 1100,
    },
  });
  productId = product.id;

  // Seed 24 units of stock
  await prisma.stockMove.create({
    data: {
      productId,
      qtyUnits: 24,
      reason: "PURCHASE",
      userId,
    },
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("createAdjustmentOp", () => {
  it("records an Adjustment + StockMove + audit row in one transaction", async () => {
    const r = await createAdjustmentOp(userId, "adj-1", {
      productId,
      reason: "ADJUSTMENT_BREAKAGE",
      qtyUnits: 3,
      note: "Dropped 3 bottles at counter",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.remainingStock).toBe(21);

    const adj = await prisma.adjustment.findUniqueOrThrow({
      where: { id: r.data.id },
    });
    expect(adj.qtyUnits).toBe(-3);
    expect(adj.reason).toBe("ADJUSTMENT_BREAKAGE");
    expect(adj.note).toBe("Dropped 3 bottles at counter");

    const move = await prisma.stockMove.findFirstOrThrow({
      where: { refType: "adjustment", refId: r.data.id },
    });
    expect(move.qtyUnits).toBe(-3);
    expect(move.reason).toBe("ADJUSTMENT_BREAKAGE");

    const ledger = await prisma.stockMove.aggregate({
      where: { productId },
      _sum: { qtyUnits: true },
    });
    expect(ledger._sum.qtyUnits).toBe(21);

    const audit = await prisma.auditLog.findFirstOrThrow({
      where: {
        tableName: "adjustments",
        recordId: r.data.id,
        action: "INSERT",
      },
    });
    expect(audit).toBeDefined();
  });

  it("refuses when stock would go negative", async () => {
    const r = await createAdjustmentOp(userId, "adj-2", {
      productId,
      reason: "ADJUSTMENT_THEFT",
      qtyUnits: 30,
      note: "trying to over-adjust",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/only.*in stock/i);

    // Make sure nothing got written
    expect(await prisma.adjustment.count()).toBe(0);
    const ledger = await prisma.stockMove.aggregate({
      where: { productId },
      _sum: { qtyUnits: true },
    });
    expect(ledger._sum.qtyUnits).toBe(24);
  });

  it("rejects empty note (Zod)", async () => {
    const r = await createAdjustmentOp(userId, "adj-3", {
      productId,
      reason: "ADJUSTMENT_BREAKAGE",
      qtyUnits: 1,
      note: "   ",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/note/i);
  });

  it("rejects qty < 1", async () => {
    const r = await createAdjustmentOp(userId, "adj-4", {
      productId,
      reason: "ADJUSTMENT_EXPIRY",
      qtyUnits: 0,
      note: "x",
    });
    expect(r.ok).toBe(false);
  });

  it("is idempotent on key reuse", async () => {
    const input = {
      productId,
      reason: "ADJUSTMENT_SAMPLE" as const,
      qtyUnits: 2,
      note: "gave to customer for testing",
    };
    const r1 = await createAdjustmentOp(userId, "adj-5", input);
    const r2 = await createAdjustmentOp(userId, "adj-5", input);
    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
    if (!r1.ok || !r2.ok) return;
    expect(r2.data.id).toBe(r1.data.id);

    expect(await prisma.adjustment.count()).toBe(1);
    expect(
      await prisma.stockMove.count({ where: { reason: "ADJUSTMENT_SAMPLE" } }),
    ).toBe(1);
  });

  it("refuses on archived product", async () => {
    await prisma.product.update({
      where: { id: productId },
      data: { active: false },
    });
    const r = await createAdjustmentOp(userId, "adj-6", {
      productId,
      reason: "ADJUSTMENT_BREAKAGE",
      qtyUnits: 1,
      note: "x",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/archived/i);
  });
});
