import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type SessionWithSummary = {
  id: string;
  openedAt: Date;
  openedBy: { id: string; name: string };
  openingFloat: number;
  closedAt: Date | null;
  closedBy: { id: string; name: string } | null;
  closingCount: number | null;
  expectedCash: number | null;
  variance: number | null;
  note: string | null;
  cashSalesTotal: number;     // live for open sessions, frozen for closed
  cashSalesCount: number;
};

type AnyClient = PrismaClient | Prisma.TransactionClient;

/**
 * Sum of CASH amountPaid for sales between the session's openedAt and
 * either closedAt or now. CASH sales without a matching open session
 * (shouldn't happen once Sprint 7 lands) will count against whichever
 * session covers their timestamp.
 */
export async function sumCashSalesForSession(
  client: AnyClient,
  openedAt: Date,
  closedAt: Date | null,
): Promise<{ total: number; count: number }> {
  const where: Prisma.SaleWhereInput = {
    paymentMethod: "CASH",
    date: { gte: openedAt, ...(closedAt ? { lte: closedAt } : {}) },
  };
  const agg = await client.sale.aggregate({
    where,
    _sum: { amountPaid: true },
    _count: { _all: true },
  });
  return {
    total: agg._sum.amountPaid ?? 0,
    count: agg._count._all,
  };
}

export async function getOpenSession(): Promise<SessionWithSummary | null> {
  const s = await prisma.cashSession.findFirst({
    where: { closedAt: null },
    include: {
      openedBy: { select: { id: true, name: true } },
      closedBy: { select: { id: true, name: true } },
    },
  });
  if (!s) return null;
  const sums = await sumCashSalesForSession(prisma, s.openedAt, null);
  return {
    id: s.id,
    openedAt: s.openedAt,
    openedBy: s.openedBy,
    openingFloat: s.openingFloat,
    closedAt: null,
    closedBy: null,
    closingCount: null,
    expectedCash: null,
    variance: null,
    note: s.note,
    cashSalesTotal: sums.total,
    cashSalesCount: sums.count,
  };
}

export async function getSession(id: string): Promise<SessionWithSummary | null> {
  const s = await prisma.cashSession.findUnique({
    where: { id },
    include: {
      openedBy: { select: { id: true, name: true } },
      closedBy: { select: { id: true, name: true } },
    },
  });
  if (!s) return null;
  const sums = await sumCashSalesForSession(prisma, s.openedAt, s.closedAt);
  return {
    id: s.id,
    openedAt: s.openedAt,
    openedBy: s.openedBy,
    openingFloat: s.openingFloat,
    closedAt: s.closedAt,
    closedBy: s.closedBy,
    closingCount: s.closingCount,
    expectedCash: s.expectedCash,
    variance: s.variance,
    note: s.note,
    cashSalesTotal: sums.total,
    cashSalesCount: sums.count,
  };
}

export async function listSessions(limit = 50) {
  return prisma.cashSession.findMany({
    orderBy: { openedAt: "desc" },
    take: limit,
    include: {
      openedBy: { select: { name: true } },
      closedBy: { select: { name: true } },
    },
  });
}
