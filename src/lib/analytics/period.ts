/**
 * Period helpers for the /analytics page. The owner picks a preset
 * (this month, last month, 7 days, 30 days) and we resolve to a
 * concrete [from, to] range plus the matching previous period for
 * delta comparisons.
 */

export type PeriodKey =
  | "week"
  | "month"
  | "last_month"
  | "7d"
  | "30d"
  | "custom";

export const PERIOD_KEYS: PeriodKey[] = [
  "week",
  "month",
  "last_month",
  "7d",
  "30d",
  "custom",
];

export const DEFAULT_PERIOD: PeriodKey = "week";

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

/**
 * Mon-Sun week, matching standard practice in Rwanda. The JS
 * `getDay()` returns 0=Sun..6=Sat so we shift to get Monday=0.
 */
function startOfWeek(d: Date): Date {
  const c = startOfDay(d);
  const monIdx = (c.getDay() + 6) % 7; // Mon=0..Sun=6
  c.setDate(c.getDate() - monIdx);
  return c;
}

function endOfWeek(d: Date): Date {
  const s = startOfWeek(d);
  return endOfDay(addDays(s, 6));
}

/**
 * Days inclusive between two dates (i.e. same-day = 1).
 */
function dayCountInclusive(from: Date, to: Date): number {
  const ms = endOfDay(to).getTime() - startOfDay(from).getTime();
  return Math.round(ms / (24 * 60 * 60 * 1000)) + 1;
}

export type ResolveOpts = {
  /** Used only when key === "custom". */
  customFrom?: Date | null;
  customTo?: Date | null;
};

export function resolvePeriod(
  key: PeriodKey,
  now: Date = new Date(),
  opts: ResolveOpts = {},
): Period {
  if (key === "week") {
    const from = startOfWeek(now);
    const to = endOfWeek(now);
    const prevTo = endOfDay(addDays(from, -1));
    const prevFrom = startOfDay(addDays(from, -7));
    return { key, from, to, prevFrom, prevTo, days: 7 };
  }
  if (key === "custom") {
    // Fall back to "this week" if the dates are missing or inverted —
    // a friendlier default than throwing.
    const cFrom = opts.customFrom ?? null;
    const cTo = opts.customTo ?? null;
    if (!cFrom || !cTo || cFrom > cTo) {
      return resolvePeriod("week", now);
    }
    const from = startOfDay(cFrom);
    const to = endOfDay(cTo);
    const days = dayCountInclusive(from, to);
    const prevTo = endOfDay(addDays(from, -1));
    const prevFrom = startOfDay(addDays(prevTo, -(days - 1)));
    return { key, from, to, prevFrom, prevTo, days };
  }
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
