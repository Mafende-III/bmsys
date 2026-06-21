import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { runStockTakeOp } from "@/lib/stock-takes/operations";

const prisma = new PrismaClient({
  datasourceUrl: process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL,
});

let userId: string;
let productAId: string;
let productBId: string;
const TEST_USER_PHONE = "+250000999020";

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
      name: "Stock Take Test",
      phone: TEST_USER_PHONE,
      pinHash: "x",
      role: "OWNER",
    },
  });
  userId = user.id;

  const a = await prisma.product.create({
    data: {
      sku: "ST-A",
      name: "Stock-take A",
      unitsPerCarton: 12,
      costPerCarton: 1000,
      unitPrice: 100,
      cartonPrice: 1100,
    },
  });
  productAId = a.id;

  const b = await prisma.product.create({
    data: {
      sku: "ST-B",
      name: "Stock-take B",
      unitsPerCarton: 6,
      costPerCarton: 600,
      unitPrice: 110,
      cartonPrice: 600,
    },
  });
  productBId = b.id;

  // Seed 24 of A, 10 of B from a fake purchase.
  await prisma.stockMove.createMany({
    data: [
      { productId: productAId, qtyUnits: 24, reason: "PURCHASE", userId },
      { productId: productBId, qtyUnits: 10, reason: "PURCHASE", userId },
    ],
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("runStockTakeOp", () => {
  it("writes one STOCKTAKE_VARIANCE move per non-matching line, none for matches", async () => {
    const r = await runStockTakeOp(userId, "st-1", {
      note: "Monthly count",
      lines: [
        { productId: productAId, countedUnits: 22 }, // short 2
        { productId: productBId, countedUnits: 10 }, // matches
      ],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.adjustedCount).toBe(1);
    expect(r.data.totalProducts).toBe(2);

    const moves = await prisma.stockMove.findMany({
      where: { reason: "STOCKTAKE_VARIANCE" },
      orderBy: { productId: "asc" },
    });
    expect(moves).toHaveLength(1);
    expect(moves[0]?.productId).toBe(productAId);
    expect(moves[0]?.qtyUnits).toBe(-2);
    expect(moves[0]?.note).toBe("Monthly count");

    const ledgerA = await prisma.stockMove.aggregate({
      where: { productId: productAId },
      _sum: { qtyUnits: true },
    });
    expect(ledgerA._sum.qtyUnits).toBe(22);

    const ledgerB = await prisma.stockMove.aggregate({
      where: { productId: productBId },
      _sum: { qtyUnits: true },
    });
    expect(ledgerB._sum.qtyUnits).toBe(10);
  });

  it("writes positive variances for over-counts (someone restocked manually)", async () => {
    const r = await runStockTakeOp(userId, "st-2", {
      note: "Found extra stash",
      lines: [
        { productId: productAId, countedUnits: 30 }, // over by 6
        { productId: productBId, countedUnits: 7 }, // short by 3
      ],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.adjustedCount).toBe(2);

    const moveA = await prisma.stockMove.findFirstOrThrow({
      where: { productId: productAId, reason: "STOCKTAKE_VARIANCE" },
    });
    const moveB = await prisma.stockMove.findFirstOrThrow({
      where: { productId: productBId, reason: "STOCKTAKE_VARIANCE" },
    });
    expect(moveA.qtyUnits).toBe(6);
    expect(moveB.qtyUnits).toBe(-3);
  });

  it("writes a single AuditLog row summarising the whole stock-take", async () => {
    const r = await runStockTakeOp(userId, "st-3", {
      note: "Sunday close",
      lines: [
        { productId: productAId, countedUnits: 20 },
        { productId: productBId, countedUnits: 10 },
      ],
    });
    expect(r.ok).toBe(true);

    const audits = await prisma.auditLog.findMany({
      where: { tableName: "stock_takes" },
    });
    expect(audits).toHaveLength(1);
    const change = audits[0]?.changes as Record<string, unknown>;
    expect(change.note).toBe("Sunday close");
    expect(change.lineCount).toBe(2);
    expect(change.adjustedCount).toBe(1);
  });

  it("is idempotent on key reuse", async () => {
    const input = {
      note: "first attempt",
      lines: [{ productId: productAId, countedUnits: 18 }],
    };
    const r1 = await runStockTakeOp(userId, "st-4", input);
    const r2 = await runStockTakeOp(userId, "st-4", input);
    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
    if (!r1.ok || !r2.ok) return;
    expect(r2.data.id).toBe(r1.data.id);

    const moves = await prisma.stockMove.count({
      where: { reason: "STOCKTAKE_VARIANCE" },
    });
    expect(moves).toBe(1);
  });

  it("ignores archived products without crashing", async () => {
    await prisma.product.update({
      where: { id: productAId },
      data: { active: false },
    });
    const r = await runStockTakeOp(userId, "st-5", {
      note: "ignore archived",
      lines: [
        { productId: productAId, countedUnits: 0 }, // archived → skip
        { productId: productBId, countedUnits: 8 }, // short by 2
      ],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.adjustedCount).toBe(1);

    expect(
      await prisma.stockMove.count({
        where: { reason: "STOCKTAKE_VARIANCE" },
      }),
    ).toBe(1);
  });

  it("rejects empty note", async () => {
    const r = await runStockTakeOp(userId, "st-6", {
      note: "   ",
      lines: [{ productId: productAId, countedUnits: 24 }],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/note/i);
  });

  it("rejects empty lines array", async () => {
    const r = await runStockTakeOp(userId, "st-7", {
      note: "x",
      lines: [],
    });
    expect(r.ok).toBe(false);
  });

  it("rejects negative counted units", async () => {
    const r = await runStockTakeOp(userId, "st-8", {
      note: "x",
      lines: [{ productId: productAId, countedUnits: -1 }],
    });
    expect(r.ok).toBe(false);
  });
});
