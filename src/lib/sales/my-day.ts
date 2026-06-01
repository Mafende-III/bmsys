import { prisma } from "@/lib/prisma";

export type MyDayStats = {
  today: { date: Date; salesCount: number; total: number };
  weekToDate: { salesCount: number; total: number };
  topProductToday: {
    productId: string;
    name: string;
    sku: string;
    unitsSold: number;
    revenue: number;
  } | null;
  daily: { iso: string; label: string; total: number; count: number }[];
};

function startOfDay(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

function endOfDay(d: Date): Date {
  const c = new Date(d);
  c.setHours(23, 59, 59, 999);
  return c;
}

function addDays(d: Date, n: number): Date {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}

/**
 * Per-user "My day" stats — scoped to the signed-in user (so a seller
 * only sees their own ringing-up, never anyone else's). Owners can hit
 * the same page to see their personal day too.
 *
 * Includes:
 * - today's sale count and total
 * - week-to-date (last 7 days inclusive) count and total
 * - top product the user sold today
 * - a daily series for the last 7 days for the mini bar trend
 */
export async function getMyDay(userId: string): Promise<MyDayStats> {
  const now = new Date();
  const todayFrom = startOfDay(now);
  const todayTo = endOfDay(now);
  const sevenFrom = startOfDay(addDays(now, -6));

  // 1. Today's sales (count + total)
  const todayAgg = await prisma.sale.aggregate({
    where: {
      userId,
      status: "COMPLETE",
      date: { gte: todayFrom, lte: todayTo },
    },
    _sum: { total: true },
    _count: { _all: true },
  });

  // 2. Last 7 days totals + count
  const weekAgg = await prisma.sale.aggregate({
    where: {
      userId,
      status: "COMPLETE",
      date: { gte: sevenFrom, lte: todayTo },
    },
    _sum: { total: true },
    _count: { _all: true },
  });

  // 3. Top product the user sold today (by units = SaleLine.qty)
  const lineGroups = await prisma.saleLine.groupBy({
    by: ["productId"],
    where: {
      sale: {
        userId,
        status: "COMPLETE",
        date: { gte: todayFrom, lte: todayTo },
      },
    },
    _sum: { qty: true, lineTotal: true },
    orderBy: { _sum: { qty: "desc" } },
    take: 1,
  });
  let topProductToday: MyDayStats["topProductToday"] = null;
  const top = lineGroups[0];
  if (top) {
    const product = await prisma.product.findUnique({
      where: { id: top.productId },
      select: { id: true, sku: true, name: true },
    });
    if (product) {
      topProductToday = {
        productId: product.id,
        name: product.name,
        sku: product.sku,
        unitsSold: top._sum?.qty ?? 0,
        revenue: top._sum?.lineTotal ?? 0,
      };
    }
  }

  // 4. Daily series for the last 7 days
  const dailyRows = await prisma.sale.findMany({
    where: {
      userId,
      status: "COMPLETE",
      date: { gte: sevenFrom, lte: todayTo },
    },
    select: { date: true, total: true },
  });
  const dailyMap = new Map<string, { total: number; count: number }>();
  for (let i = 0; i < 7; i++) {
    const d = startOfDay(addDays(sevenFrom, i));
    const key = d.toISOString().slice(0, 10);
    dailyMap.set(key, { total: 0, count: 0 });
  }
  for (const r of dailyRows) {
    const key = startOfDay(r.date).toISOString().slice(0, 10);
    const slot = dailyMap.get(key);
    if (slot) {
      slot.total += r.total;
      slot.count += 1;
    }
  }
  const daily = Array.from(dailyMap.entries()).map(([iso, v]) => {
    const d = new Date(iso + "T00:00:00");
    return {
      iso,
      label: d.toLocaleDateString(undefined, {
        weekday: "short",
        day: "numeric",
      }),
      total: v.total,
      count: v.count,
    };
  });

  return {
    today: {
      date: todayFrom,
      salesCount: todayAgg._count._all,
      total: todayAgg._sum.total ?? 0,
    },
    weekToDate: {
      salesCount: weekAgg._count._all,
      total: weekAgg._sum.total ?? 0,
    },
    topProductToday,
    daily,
  };
}
