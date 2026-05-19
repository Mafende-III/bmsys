import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type ExpenseFilters = {
  categoryId?: string;
  paymentMethod?: "CASH" | "MOMO" | "BANK" | "all";
  from?: Date;
  to?: Date;
};

type AnyClient = PrismaClient | Prisma.TransactionClient;

export async function listExpenseCategories() {
  return prisma.expenseCategory.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, slug: true },
  });
}

export async function listExpenses(filters: ExpenseFilters = {}) {
  const where: Prisma.ExpenseWhereInput = {};
  if (filters.categoryId) where.categoryId = filters.categoryId;
  if (filters.paymentMethod && filters.paymentMethod !== "all") {
    where.paymentMethod = filters.paymentMethod;
  }
  if (filters.from || filters.to) {
    where.date = {};
    if (filters.from) where.date.gte = filters.from;
    if (filters.to) where.date.lte = filters.to;
  }

  return prisma.expense.findMany({
    where,
    orderBy: { date: "desc" },
    take: 200,
    include: {
      category: { select: { name: true } },
      supplier: { select: { name: true } },
      user: { select: { name: true } },
    },
  });
}

export async function getExpense(id: string) {
  return prisma.expense.findUnique({
    where: { id },
    include: {
      category: { select: { name: true } },
      supplier: { select: { name: true } },
      user: { select: { name: true } },
      recurring: { select: { id: true, description: true } },
    },
  });
}

export async function listRecurring() {
  return prisma.recurringExpense.findMany({
    orderBy: [{ active: "desc" }, { description: "asc" }],
    include: {
      category: { select: { name: true } },
      _count: { select: { expenses: true } },
    },
  });
}

export async function getRecurring(id: string) {
  return prisma.recurringExpense.findUnique({
    where: { id },
    include: { category: { select: { name: true } } },
  });
}

/**
 * Sum of CASH expenses between openedAt and closedAt — subtracted from
 * expected cash on session close.
 */
export async function sumCashExpensesForSession(
  client: AnyClient,
  openedAt: Date,
  closedAt: Date | null,
): Promise<{ total: number; count: number }> {
  const agg = await client.expense.aggregate({
    where: {
      paymentMethod: "CASH",
      date: { gte: openedAt, ...(closedAt ? { lte: closedAt } : {}) },
    },
    _sum: { amount: true },
    _count: { _all: true },
  });
  return {
    total: agg._sum.amount ?? 0,
    count: agg._count._all,
  };
}
