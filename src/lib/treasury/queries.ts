import { prisma } from "@/lib/prisma";

/**
 * Working-capital derivation. Three pots:
 *
 *  Cash on hand — from the till: open session's float + cash sales −
 *  cash expenses − cash transfers since opening; when the till is
 *  closed, the last closing count minus transfers made since closing.
 *
 *  MoMo / Bank — owner-set checkpoint (Settings.momoOpeningBalance at
 *  momoCheckpointAt) plus flows since: sales paid by that method,
 *  minus expenses paid by that method, plus cash transfers into it.
 *  A null checkpoint means the pot was never initialised; the UI
 *  prompts the owner to set it instead of showing a made-up number.
 */

export type PotBalance = {
  balance: number;
  initialised: boolean;
  checkpointAt: Date | null;
};

export type WorkingCapital = {
  cashOnHand: number;
  tillOpen: boolean;
  momo: PotBalance;
  bank: PotBalance;
  /// Sum of the initialised pots + cash.
  totalAvailable: number;
};

async function flowsSince(
  method: "MOMO" | "BANK",
  since: Date,
): Promise<number> {
  const [sales, expenses, transfersIn] = await Promise.all([
    prisma.sale.aggregate({
      where: {
        status: "COMPLETE",
        paymentMethod: method,
        date: { gte: since },
      },
      _sum: { total: true },
    }),
    prisma.expense.aggregate({
      where: { paymentMethod: method, date: { gte: since } },
      _sum: { amount: true },
    }),
    prisma.cashTransfer.aggregate({
      where: { toMethod: method, createdAt: { gte: since } },
      _sum: { amount: true },
    }),
  ]);
  return (
    (sales._sum.total ?? 0) -
    (expenses._sum.amount ?? 0) +
    (transfersIn._sum.amount ?? 0)
  );
}

export async function getWorkingCapital(): Promise<WorkingCapital> {
  const settings = await prisma.settings.findUnique({
    where: { id: "default" },
    select: {
      momoOpeningBalance: true,
      momoCheckpointAt: true,
      bankOpeningBalance: true,
      bankCheckpointAt: true,
    },
  });

  // ── Cash on hand ──────────────────────────────────────────────────
  const openSession = await prisma.cashSession.findFirst({
    where: { closedAt: null },
    orderBy: { openedAt: "desc" },
  });
  let cashOnHand = 0;
  let tillOpen = false;
  if (openSession) {
    tillOpen = true;
    const [cashSales, cashExpenses, transfersOut] = await Promise.all([
      prisma.sale.aggregate({
        where: {
          status: "COMPLETE",
          paymentMethod: "CASH",
          date: { gte: openSession.openedAt },
        },
        _sum: { total: true },
      }),
      prisma.expense.aggregate({
        where: { paymentMethod: "CASH", date: { gte: openSession.openedAt } },
        _sum: { amount: true },
      }),
      prisma.cashTransfer.aggregate({
        where: { createdAt: { gte: openSession.openedAt } },
        _sum: { amount: true },
      }),
    ]);
    cashOnHand =
      openSession.openingFloat +
      (cashSales._sum.total ?? 0) -
      (cashExpenses._sum.amount ?? 0) -
      (transfersOut._sum.amount ?? 0);
  } else {
    const lastClosed = await prisma.cashSession.findFirst({
      where: { closedAt: { not: null } },
      orderBy: { closedAt: "desc" },
    });
    if (lastClosed?.closingCount != null && lastClosed.closedAt) {
      const transfersOut = await prisma.cashTransfer.aggregate({
        where: { createdAt: { gte: lastClosed.closedAt } },
        _sum: { amount: true },
      });
      cashOnHand = lastClosed.closingCount - (transfersOut._sum.amount ?? 0);
    }
  }

  // ── MoMo / Bank pots ─────────────────────────────────────────────
  const momoInitialised = settings?.momoCheckpointAt != null;
  const bankInitialised = settings?.bankCheckpointAt != null;
  const momoBalance = momoInitialised
    ? (settings!.momoOpeningBalance ?? 0) +
      (await flowsSince("MOMO", settings!.momoCheckpointAt!))
    : 0;
  const bankBalance = bankInitialised
    ? (settings!.bankOpeningBalance ?? 0) +
      (await flowsSince("BANK", settings!.bankCheckpointAt!))
    : 0;

  return {
    cashOnHand,
    tillOpen,
    momo: {
      balance: momoBalance,
      initialised: momoInitialised,
      checkpointAt: settings?.momoCheckpointAt ?? null,
    },
    bank: {
      balance: bankBalance,
      initialised: bankInitialised,
      checkpointAt: settings?.bankCheckpointAt ?? null,
    },
    totalAvailable:
      cashOnHand +
      (momoInitialised ? momoBalance : 0) +
      (bankInitialised ? bankBalance : 0),
  };
}
