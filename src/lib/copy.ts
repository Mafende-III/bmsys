/**
 * Voice & tone constants — shopkeeper-friendly labels for the UI.
 *
 * Rules:
 * - Plain language over technical terms (no "SKU", "ledger", "idempotency").
 * - Verbs for primary actions ("Add product", not "New").
 * - Status words match how the shopkeeper would say them out loud.
 * - Enum values stay in the DB; only the labels we *show* change.
 */

// Adjustment reasons (StockMoveReason enum values from Prisma).
export const ADJUSTMENT_LABEL: Record<string, string> = {
  ADJUSTMENT_BREAKAGE: "Broken",
  ADJUSTMENT_EXPIRY: "Expired",
  ADJUSTMENT_PERSONAL: "Took for self",
  ADJUSTMENT_THEFT: "Stolen",
  ADJUSTMENT_SAMPLE: "Gave away",
};

// Purchase status (PurchaseStatus enum) — capitalised, no SHOUTING.
export const PURCHASE_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  RECEIVED: "Received",
  CANCELLED: "Cancelled",
};

// Sale source / status — for future reports.
export const PAYMENT_LABEL: Record<string, string> = {
  CASH: "Cash",
  MOMO: "MoMo",
  BANK: "Bank",
  CREDIT: "On credit",
  MIXED: "Mixed",
};

// Variance description for cash sessions. Returns a tagged tone label
// plus a verb sentence the operator can read at a glance.
export type VarianceTone = "balanced" | "over" | "short";

export function describeVariance(variance: number): {
  tone: VarianceTone;
  label: string;
  sentence: string;
} {
  if (variance === 0) {
    return {
      tone: "balanced",
      label: "Balanced ✓",
      sentence: "Till balances — counted cash matches expected.",
    };
  }
  if (variance > 0) {
    return {
      tone: "over",
      label: "Extra",
      sentence: `Till has ${variance.toLocaleString("en-US")} RWF more than expected.`,
    };
  }
  return {
    tone: "short",
    label: "Short",
    sentence: `Till is ${Math.abs(variance).toLocaleString("en-US")} RWF short.`,
  };
}

// Stock-move reasons turned into shopkeeper words for reports.
export const STOCK_REASON_LABEL: Record<string, string> = {
  PURCHASE: "Stock received",
  SALE_UNIT: "Sold (singles)",
  SALE_CARTON: "Sold (cartons)",
  RETURN: "Returned",
  CARTON_OPEN: "Opened a carton",
  ADJUSTMENT_BREAKAGE: "Broken",
  ADJUSTMENT_EXPIRY: "Expired",
  ADJUSTMENT_PERSONAL: "Took for self",
  ADJUSTMENT_THEFT: "Stolen",
  ADJUSTMENT_SAMPLE: "Gave away",
  STOCKTAKE_VARIANCE: "Stock-take adjustment",
};

// Empty-state strings — direct, warm, with a hint of next action.
export const EMPTY = {
  noProducts:
    "Nothing to sell yet. Add a product first to put items on the shelf.",
  noChannels: "No sales channels yet. Add one to start tracking where sales come from.",
  noSuppliers: "No suppliers yet. Add the people you buy stock from.",
  noPurchases: "No stock purchases yet. Tap Add purchase to log your first one.",
  noSalesToday: "No sales yet today.",
  noExpensesToday: "No expenses logged for this day.",
  noCashSessions: "No till activity here yet.",
  emptyCart: "🛒 Empty cart — tap a category to start.",
  noStockMoves: "No stock activity yet today.",
  cartTillClosed:
    "The till is closed. Open it with the cash in your hand before cash sales.",
} as const;

// Confirmation / destructive copy.
export const CONFIRM = {
  archiveProduct: "Stop selling this product?",
  archiveProductWarning:
    "It will be hidden from the sell screen. You can show it again later.",
  hideChannel: "Hide this channel?",
  cancelPurchase: "Cancel this purchase?",
  cancelReceivedPurchase:
    "Cancel and undo the stock that was received? Only works if none of it has been sold yet.",
  deactivateSeller: "Stop this person from logging in?",
} as const;
