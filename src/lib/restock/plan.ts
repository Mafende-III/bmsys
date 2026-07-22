/**
 * Pure restock math. Kept free of Prisma so the arithmetic has direct
 * unit tests — the query layer feeds it real numbers.
 *
 * Conventions:
 *  - burn window: how many days of sales history the daily rate is
 *    averaged over (14 by default — long enough to smooth a quiet
 *    weekend, short enough to track a trend).
 *  - cover target: how many days of stock the owner wants on the
 *    shelf after the order arrives (30 by default).
 *  - suggestions are whole cartons, ceiling-rounded — you can't order
 *    half a carton, and rounding down would under-cover.
 */

export const BURN_WINDOW_DAYS = 14;
export const COVER_TARGET_DAYS = 30;

export type RestockUrgency = "OUT" | "CRITICAL" | "LOW" | "OK";

export type RestockLine = {
  /// Average units sold per day over the burn window.
  dailyBurn: number;
  /// Whole days of stock left at the current burn rate. Null when the
  /// product has no sales in the window (no rate → no forecast).
  daysToOut: number | null;
  urgency: RestockUrgency;
  /// Whole cartons to order to reach the cover target. 0 when covered
  /// or when there is no burn to plan against.
  suggestedCartons: number;
  suggestedUnits: number;
  estimatedCost: number;
};

export function computeRestockLine(opts: {
  stockUnits: number;
  unitsSoldInWindow: number;
  unitsPerCarton: number;
  costPerCarton: number;
  burnWindowDays?: number;
  coverTargetDays?: number;
}): RestockLine {
  const windowDays = opts.burnWindowDays ?? BURN_WINDOW_DAYS;
  const coverDays = opts.coverTargetDays ?? COVER_TARGET_DAYS;
  const upc = Math.max(1, opts.unitsPerCarton);

  const dailyBurn = opts.unitsSoldInWindow / windowDays;

  if (dailyBurn <= 0) {
    // No sales in the window — nothing to forecast. Stock 0 with no
    // burn is "dormant", not "out": suggesting an order for something
    // nobody buys would be noise.
    return {
      dailyBurn: 0,
      daysToOut: null,
      urgency: "OK",
      suggestedCartons: 0,
      suggestedUnits: 0,
      estimatedCost: 0,
    };
  }

  const daysToOut = Math.floor(opts.stockUnits / dailyBurn);
  const urgency: RestockUrgency =
    opts.stockUnits <= 0
      ? "OUT"
      : daysToOut <= 3
        ? "CRITICAL"
        : daysToOut <= 7
          ? "LOW"
          : "OK";

  const targetUnits = Math.ceil(dailyBurn * coverDays);
  const deficitUnits = Math.max(0, targetUnits - opts.stockUnits);
  const suggestedCartons = Math.ceil(deficitUnits / upc);
  const suggestedUnits = suggestedCartons * upc;
  return {
    dailyBurn,
    daysToOut,
    urgency,
    suggestedCartons,
    suggestedUnits,
    estimatedCost: suggestedCartons * opts.costPerCarton,
  };
}
