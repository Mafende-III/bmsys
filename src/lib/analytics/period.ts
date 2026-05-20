/**
 * Period helpers for the /analytics page. The owner picks a preset
 * (this month, last month, 7 days, 30 days) and we resolve to a
 * concrete [from, to] range plus the matching previous period for
 * delta comparisons.
 */

export type PeriodKey = "month" | "last_month" | "7d" | "30d";

export const PERIOD_KEYS: PeriodKey[] = ["month", "last_month", "7d", "30d"];

export type Period = {
  key: PeriodKey;
  from: Date;
  to: Date;
  /** Previous period of the same length, for delta comparisons. */
  prevFrom: Date;
  prevTo: Date;
  /** Number of days in the period (inclusive on both ends). */
  days: number;
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

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

export function resolvePeriod(key: PeriodKey, now: Date = new Date()): Period {
  if (key === "month") {
    const from = startOfMonth(now);
    const to = endOfMonth(now);
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevFrom = startOfMonth(prevMonth);
    const prevTo = endOfMonth(prevMonth);
    return {
      key,
      from,
      to,
      prevFrom,
      prevTo,
      days: Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)) + 1,
    };
  }
  if (key === "last_month") {
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const from = startOfMonth(lastMonth);
    const to = endOfMonth(lastMonth);
    const monthBefore = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    const prevFrom = startOfMonth(monthBefore);
    const prevTo = endOfMonth(monthBefore);
    return {
      key,
      from,
      to,
      prevFrom,
      prevTo,
      days: Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)) + 1,
    };
  }
  // Rolling-window cases.
  const days = key === "7d" ? 7 : 30;
  const to = endOfDay(now);
  const from = startOfDay(addDays(now, -(days - 1)));
  const prevTo = endOfDay(addDays(from, -1));
  const prevFrom = startOfDay(addDays(from, -days));
  return { key, from, to, prevFrom, prevTo, days };
}

export function isPeriodKey(v: unknown): v is PeriodKey {
  return typeof v === "string" && (PERIOD_KEYS as readonly string[]).includes(v);
}
