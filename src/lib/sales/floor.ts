/**
 * Pure helpers for the discount floor. Server-side validation in
 * createSaleOp and live client-side feedback in the cart both use the
 * same math here so the disabled "Pay" button on the cart and the
 * server-side guard cannot disagree.
 *
 * Margin is in basis points (10000 = 100%). Floor per line is computed
 * with integer arithmetic, ceiling-rounded so a rounding penny never
 * sneaks below the owner's minimum profit.
 */

export type FloorCheckInput = {
  saleUnit: "UNIT" | "CARTON";
  qty: number;
  unitPrice: number;
  costPerCarton: number;
  unitsPerCarton: number;
  marginBps: number;
};

export function maxAllowedLineDiscount(opts: FloorCheckInput): number {
  const { saleUnit, qty, unitPrice, costPerCarton, unitsPerCarton } = opts;
  const bps = Math.max(0, opts.marginBps);
  const grossRevenue = qty * unitPrice;

  if (costPerCarton <= 0) return Math.max(0, grossRevenue);

  let floorScaled: bigint;
  let scale: bigint;
  if (saleUnit === "UNIT") {
    if (unitsPerCarton <= 0) return 0;
    floorScaled = BigInt(qty) * BigInt(costPerCarton) * BigInt(10000 + bps);
    scale = BigInt(10000) * BigInt(unitsPerCarton);
  } else {
    floorScaled = BigInt(qty) * BigInt(costPerCarton) * BigInt(10000 + bps);
    scale = BigInt(10000);
  }
  const floor = Number((floorScaled + scale - 1n) / scale);
  return Math.max(0, grossRevenue - floor);
}

/** Resolve per-line margin: per-product override wins, else settings default. */
export function resolveMarginBps(
  productMinMarginBps: number,
  defaultMinMarginBps: number,
): number {
  return productMinMarginBps > 0 ? productMinMarginBps : defaultMinMarginBps;
}
