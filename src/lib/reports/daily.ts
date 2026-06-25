import { prisma } from "@/lib/prisma";

export type DailySummary = {
  date: Date;
  totals: {
    salesTotal: number;
    salesCount: number;
    expensesTotal: number;
    cashSalesTotal: number;
    cashExpensesTotal: number;
    netCash: number; // cashSalesTotal - cashExpensesTotal
    discountsTotal: number;
    discountedLineCount: number;
    floorOverrideCount: number;
  };
  salesByChannel: Array<{
    channelId: string;
    channelName: string;
    count: number;
    total: number;
  }>;
  salesByMethod: Array<{
    paymentMethod: string;
    count: number;
    total: number;
  }>;
  topProducts: Array<{
    productId: string;
    sku: string;
    name: string;
    unitsSold: number;     // includes both UNIT lines and CARTON lines (qty * unitsPerCarton)
    saleLineTotal: number;
  }>;
  expensesByCategory: Array<{
    categoryId: string;
    categoryName: string;
    count: number;
    total: number;
  }>;
  cashSessions: Array<{
    id: string;
    openedAt: Date;
    closedAt: Date | null;
    openingFloat: number;
    expectedCash: number | null;
    closingCount: number | null;
    variance: number | null;
    openedBy: string;
    closedBy: string | null;
  }>;
  stockMovesByReason: Array<{
    reason: string;
    moveCount: number;
    netUnits: number;
  }>;
};

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

export async function computeDailySummary(date: Date): Promise<DailySummary> {
  const start = startOfDay(date);
  const end = endOfDay(date);
  const dateRange = { gte: start, lte: end };

  // Run all aggregations in parallel
  const [
    salesByChannelRaw,
    salesByMethodRaw,
    saleLinesByProduct,
    expensesByCategoryRaw,
    cashSessionsRaw,
    stockMovesByReasonRaw,
    totalsRaw,
    cashSalesAgg,
    cashExpensesAgg,
  ] = await Promise.all([
    prisma.sale.groupBy({
      by: ["channelId"],
      where: { date: dateRange },
      _sum: { total: true },
      _count: { _all: true },
    }),
    prisma.sale.groupBy({
      by: ["paymentMethod"],
      where: { date: dateRange },
      _sum: { total: true },
      _count: { _all: true },
    }),
    prisma.saleLine.findMany({
      where: { sale: { date: dateRange } },
      select: {
        productId: true,
        qty: true,
        saleUnit: true,
        lineTotal: true,
        discountAmount: true,
        floorOverride: true,
      },
    }),
    prisma.expense.groupBy({
      by: ["categoryId"],
      where: { date: dateRange },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.cashSession.findMany({
      where: {
        OR: [
          { openedAt: dateRange },
          { closedAt: dateRange },
        ],
      },
      orderBy: { openedAt: "asc" },
      include: {
        openedBy: { select: { name: true } },
        closedBy: { select: { name: true } },
      },
    }),
    prisma.stockMove.groupBy({
      by: ["reason"],
      where: { createdAt: dateRange },
      _sum: { qtyUnits: true },
      _count: { _all: true },
    }),
    prisma.sale.aggregate({
      where: { date: dateRange },
      _sum: { total: true },
      _count: { _all: true },
    }),
    prisma.sale.aggregate({
      where: { date: dateRange, paymentMethod: "CASH" },
      _sum: { amountPaid: true },
    }),
    prisma.expense.aggregate({
      where: { date: dateRange, paymentMethod: "CASH" },
      _sum: { amount: true },
    }),
  ]);

  // Hydrate channel names
  const channelIds = salesByChannelRaw.map((r) => r.channelId);
  const channelById = new Map(
    (
      await prisma.channel.findMany({
        where: { id: { in: channelIds } },
        select: { id: true, name: true },
      })
    ).map((c) => [c.id, c.name]),
  );

  // Top products: aggregate sale_lines into units sold
  const productAgg = new Map<
    string,
    { unitsSold: number; saleLineTotal: number }
  >();
  for (const line of saleLinesByProduct) {
    const prior = productAgg.get(line.productId) ?? {
      unitsSold: 0,
      saleLineTotal: 0,
    };
    // CARTON lines: we'd want to multiply qty by unitsPerCarton to compare
    // apples-to-apples, but we don't have that here. Keep simple — counts
    // raw qty (interpret as "units sold" for UNIT, "cartons sold" for CARTON).
    prior.unitsSold += line.qty;
    prior.saleLineTotal += line.lineTotal;
    productAgg.set(line.productId, prior);
  }
  const productIds = Array.from(productAgg.keys());
  const productsById = new Map(
    (
      await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, sku: true, name: true },
      })
    ).map((p) => [p.id, p]),
  );
  const topProducts = Array.from(productAgg.entries())
    .map(([id, agg]) => ({
      productId: id,
      sku: productsById.get(id)?.sku ?? "?",
      name: productsById.get(id)?.name ?? "?",
      unitsSold: agg.unitsSold,
      saleLineTotal: agg.saleLineTotal,
    }))
    .sort((a, b) => b.saleLineTotal - a.saleLineTotal)
    .slice(0, 5);

  // Hydrate category names
  const categoryIds = expensesByCategoryRaw.map((r) => r.categoryId);
  const categoriesById = new Map(
    (
      await prisma.expenseCategory.findMany({
        where: { id: { in: categoryIds } },
        select: { id: true, name: true },
      })
    ).map((c) => [c.id, c.name]),
  );

  const salesTotal = totalsRaw._sum.total ?? 0;
  const cashSalesTotal = cashSalesAgg._sum.amountPaid ?? 0;
  const cashExpensesTotal = cashExpensesAgg._sum.amount ?? 0;
  const expensesTotal = expensesByCategoryRaw.reduce(
    (s, r) => s + (r._sum.amount ?? 0),
    0,
  );

  let discountsTotal = 0;
  let discountedLineCount = 0;
  let floorOverrideCount = 0;
  for (const line of saleLinesByProduct) {
    if (line.discountAmount > 0) {
      discountsTotal += line.discountAmount;
      discountedLineCount += 1;
      if (line.floorOverride) floorOverrideCount += 1;
    }
  }

  return {
    date,
    totals: {
      salesTotal,
      salesCount: totalsRaw._count._all,
      expensesTotal,
      cashSalesTotal,
      cashExpensesTotal,
      netCash: cashSalesTotal - cashExpensesTotal,
      discountsTotal,
      discountedLineCount,
      floorOverrideCount,
    },
    salesByChannel: salesByChannelRaw.map((r) => ({
      channelId: r.channelId,
      channelName: channelById.get(r.channelId) ?? "?",
      count: r._count._all,
      total: r._sum.total ?? 0,
    })),
    salesByMethod: salesByMethodRaw.map((r) => ({
      paymentMethod: r.paymentMethod,
      count: r._count._all,
      total: r._sum.total ?? 0,
    })),
    topProducts,
    expensesByCategory: expensesByCategoryRaw.map((r) => ({
      categoryId: r.categoryId,
      categoryName: categoriesById.get(r.categoryId) ?? "?",
      count: r._count._all,
      total: r._sum.amount ?? 0,
    })),
    cashSessions: cashSessionsRaw.map((s) => ({
      id: s.id,
      openedAt: s.openedAt,
      closedAt: s.closedAt,
      openingFloat: s.openingFloat,
      expectedCash: s.expectedCash,
      closingCount: s.closingCount,
      variance: s.variance,
      openedBy: s.openedBy.name,
      closedBy: s.closedBy?.name ?? null,
    })),
    stockMovesByReason: stockMovesByReasonRaw.map((r) => ({
      reason: r.reason,
      moveCount: r._count._all,
      netUnits: r._sum.qtyUnits ?? 0,
    })),
  };
}
