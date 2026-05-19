import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { computeDailySummary } from "@/lib/reports/daily";

const prisma = new PrismaClient({
  datasourceUrl: process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL,
});

let userId: string;
let channelId: string;
let categoryId: string;
let productId: string;
const TEST_USER_PHONE = "+250000999012";

const fullWipe = () =>
  prisma.$transaction([
    prisma.idempotencyKey.deleteMany({}),
    prisma.auditLog.deleteMany({}),
    prisma.cashSession.deleteMany({}),
    prisma.saleLine.deleteMany({}),
    prisma.sale.deleteMany({}),
    prisma.expense.deleteMany({}),
    prisma.recurringExpense.deleteMany({}),
    prisma.adjustment.deleteMany({}),
    prisma.stockMove.deleteMany({}),
    prisma.carton.deleteMany({}),
    prisma.channelPriceOverride.deleteMany({}),
    prisma.product.deleteMany({}),
    prisma.supplier.deleteMany({}),
    prisma.customer.deleteMany({}),
    prisma.channel.deleteMany({}),
    prisma.user.deleteMany({ where: { phone: TEST_USER_PHONE } }),
  ]);

beforeAll(fullWipe);

beforeEach(async () => {
  await fullWipe();

  const user = await prisma.user.create({
    data: {
      name: "Rpt Test",
      phone: TEST_USER_PHONE,
      pinHash: "x",
      role: "OWNER",
    },
  });
  userId = user.id;

  const channel = await prisma.channel.create({
    data: { name: "Retail", slug: "retail" },
  });
  channelId = channel.id;

  const category = await prisma.expenseCategory.upsert({
    where: { slug: "rent" },
    update: {},
    create: { name: "Rent", slug: "rent" },
  });
  categoryId = category.id;

  const product = await prisma.product.create({
    data: {
      sku: "RPT-A",
      name: "Report Product",
      unitsPerCarton: 12,
      costPerCarton: 1000,
      unitPrice: 200,
      cartonPrice: 2000,
    },
  });
  productId = product.id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("computeDailySummary", () => {
  it("returns zeros on a day with no activity", async () => {
    const s = await computeDailySummary(new Date());
    expect(s.totals.salesTotal).toBe(0);
    expect(s.totals.salesCount).toBe(0);
    expect(s.totals.expensesTotal).toBe(0);
    expect(s.salesByChannel).toHaveLength(0);
    expect(s.expensesByCategory).toHaveLength(0);
    expect(s.topProducts).toHaveLength(0);
  });

  it("aggregates today's sales, expenses, and top products", async () => {
    const today = new Date();

    // Two sales: cash + bank
    const sale1 = await prisma.sale.create({
      data: {
        channelId,
        paymentMethod: "CASH",
        total: 600,
        amountPaid: 600,
        userId,
      },
    });
    await prisma.saleLine.create({
      data: {
        saleId: sale1.id,
        productId,
        saleUnit: "UNIT",
        qty: 3,
        unitPrice: 200,
        lineTotal: 600,
      },
    });

    const sale2 = await prisma.sale.create({
      data: {
        channelId,
        paymentMethod: "BANK",
        total: 2000,
        amountPaid: 2000,
        userId,
      },
    });
    await prisma.saleLine.create({
      data: {
        saleId: sale2.id,
        productId,
        saleUnit: "CARTON",
        qty: 1,
        unitPrice: 2000,
        lineTotal: 2000,
      },
    });

    // An expense
    await prisma.expense.create({
      data: {
        date: today,
        amount: 100000,
        categoryId,
        description: "Rent",
        paymentMethod: "BANK",
        userId,
      },
    });

    const s = await computeDailySummary(today);

    expect(s.totals.salesTotal).toBe(2600);
    expect(s.totals.salesCount).toBe(2);
    expect(s.totals.cashSalesTotal).toBe(600);
    expect(s.totals.expensesTotal).toBe(100000);
    expect(s.totals.cashExpensesTotal).toBe(0);
    expect(s.totals.netCash).toBe(600);

    expect(s.salesByChannel).toHaveLength(1);
    expect(s.salesByChannel[0]?.total).toBe(2600);
    expect(s.salesByMethod).toHaveLength(2);

    expect(s.topProducts).toHaveLength(1);
    expect(s.topProducts[0]?.saleLineTotal).toBe(2600);

    expect(s.expensesByCategory).toHaveLength(1);
    expect(s.expensesByCategory[0]?.total).toBe(100000);
  });

  it("excludes activity from a different day", async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    await prisma.sale.create({
      data: {
        channelId,
        paymentMethod: "CASH",
        total: 999,
        amountPaid: 999,
        userId,
        date: yesterday,
      },
    });

    const today = new Date();
    const s = await computeDailySummary(today);
    expect(s.totals.salesCount).toBe(0);
  });

  it("counts a stock_move under its reason for the day", async () => {
    await prisma.stockMove.create({
      data: {
        productId,
        qtyUnits: -2,
        reason: "ADJUSTMENT_BREAKAGE",
        userId,
      },
    });
    const s = await computeDailySummary(new Date());
    const breakageRow = s.stockMovesByReason.find(
      (r) => r.reason === "ADJUSTMENT_BREAKAGE",
    );
    expect(breakageRow?.moveCount).toBe(1);
    expect(breakageRow?.netUnits).toBe(-2);
  });

  it("picks up cash sessions opened today and closed today", async () => {
    const sess = await prisma.cashSession.create({
      data: { openingFloat: 5000, openedById: userId },
    });
    await prisma.cashSession.update({
      where: { id: sess.id },
      data: {
        closedAt: new Date(),
        closedById: userId,
        closingCount: 5000,
        expectedCash: 5000,
        variance: 0,
      },
    });
    const s = await computeDailySummary(new Date());
    expect(s.cashSessions).toHaveLength(1);
    expect(s.cashSessions[0]?.variance).toBe(0);
  });
});
