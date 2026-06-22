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
    prisma.saleLine.deleteMany({}),
    prisma.sale.deleteMany({}),
    prisma.purchaseLine.deleteMany({}),
    prisma.purchase.deleteMany({}),
    prisma.stockMove.deleteMany({}),
    prisma.carton.deleteMany({}),
    prisma.channelPriceOverride.deleteMany({}),
    prisma.product.deleteMany({}),
    prisma.category.deleteMany({}),
    prisma.channel.deleteMany({}),
    prisma.supplier.deleteMany({}),
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
  it("computes counted total from cartons*upc + loose, writes signed variance for mismatches", async () => {
    // A: 1 carton (12) + 10 loose = 22 → short 2 vs system 24
    // B: 1 carton (6) + 4 loose = 10 → matches system 10
    const r = await runStockTakeOp(userId, "st-1", {
      note: "Monthly count",
      lines: [
        { productId: productAId, countedCartons: 1, countedLooseUnits: 10 },
        { productId: productBId, countedCartons: 1, countedLooseUnits: 4 },
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
  });

  it("writes positive variances for over-counts and negative for short", async () => {
    // A: 2 cartons (24) + 6 loose = 30 → over by 6
    // B: 1 carton (6) + 1 loose = 7 → short by 3
    const r = await runStockTakeOp(userId, "st-2", {
      note: "Found extra stash",
      lines: [
        { productId: productAId, countedCartons: 2, countedLooseUnits: 6 },
        { productId: productBId, countedCartons: 1, countedLooseUnits: 1 },
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

  it("treats sealed-only counts as zero loose without writing a phantom variance", async () => {
    // A: 2 cartons (24) + 0 loose = 24 → matches system 24
    const r = await runStockTakeOp(userId, "st-3", {
      note: "All sealed",
      lines: [
        { productId: productAId, countedCartons: 2, countedLooseUnits: 0 },
        { productId: productBId, countedCartons: 1, countedLooseUnits: 4 },
      ],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.adjustedCount).toBe(0);

    expect(
      await prisma.stockMove.count({
        where: { reason: "STOCKTAKE_VARIANCE" },
      }),
    ).toBe(0);
  });

  it("writes a single AuditLog row capturing cartons + loose per line", async () => {
    const r = await runStockTakeOp(userId, "st-4", {
      note: "Sunday close",
      lines: [
        { productId: productAId, countedCartons: 1, countedLooseUnits: 8 },
        { productId: productBId, countedCartons: 1, countedLooseUnits: 4 },
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
    expect(change.adjustedCount).toBe(1); // A: 20 vs 24 short 4
    const lines = change.lines as Array<Record<string, unknown>>;
    const lineA = lines.find((l) => l.productId === productAId);
    expect(lineA?.countedCartons).toBe(1);
    expect(lineA?.countedLooseUnits).toBe(8);
    expect(lineA?.counted).toBe(20);
    expect(lineA?.variance).toBe(-4);
  });

  it("is idempotent on key reuse", async () => {
    const input = {
      note: "first attempt",
      lines: [
        { productId: productAId, countedCartons: 1, countedLooseUnits: 6 },
      ],
    };
    const r1 = await runStockTakeOp(userId, "st-5", input);
    const r2 = await runStockTakeOp(userId, "st-5", input);
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
    const r = await runStockTakeOp(userId, "st-6", {
      note: "ignore archived",
      lines: [
        { productId: productAId, countedCartons: 0, countedLooseUnits: 0 },
        { productId: productBId, countedCartons: 1, countedLooseUnits: 2 }, // 8 vs 10 → short 2
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
    const r = await runStockTakeOp(userId, "st-7", {
      note: "   ",
      lines: [
        { productId: productAId, countedCartons: 2, countedLooseUnits: 0 },
      ],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/note/i);
  });

  it("rejects empty lines array", async () => {
    const r = await runStockTakeOp(userId, "st-8", {
      note: "x",
      lines: [],
    });
    expect(r.ok).toBe(false);
  });

  it("rejects negative carton or loose counts", async () => {
    const rNegCartons = await runStockTakeOp(userId, "st-9", {
      note: "x",
      lines: [
        { productId: productAId, countedCartons: -1, countedLooseUnits: 0 },
      ],
    });
    expect(rNegCartons.ok).toBe(false);

    const rNegLoose = await runStockTakeOp(userId, "st-10", {
      note: "x",
      lines: [
        { productId: productAId, countedCartons: 0, countedLooseUnits: -3 },
      ],
    });
    expect(rNegLoose.ok).toBe(false);
  });
});
