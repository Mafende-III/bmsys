import { z } from "zod";

export const saleItemSchema = z.object({
  productId: z.string().min(1, "Product id is required"),
  saleUnit: z.enum(["UNIT", "CARTON"]),
  qty: z.coerce
    .number({ invalid_type_error: "Qty must be a number" })
    .int("Qty must be a whole number")
    .min(1, "Qty must be at least 1"),
});

export const createSaleSchema = z.object({
  channelId: z.string().min(1, "Channel is required"),
  paymentMethod: z.enum(["CASH", "MOMO", "BANK"]),
  paymentReference: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? null : v),
    z.string().trim().max(200).nullable().optional(),
  ),
  items: z.array(saleItemSchema).min(1, "Add at least one item"),
  /// Optional one-time-use coupon code typed by the cashier. Normalised
  /// to uppercase before lookup. Empty/whitespace → no coupon.
  couponCode: z.preprocess(
    (v) =>
      typeof v === "string" && v.trim() !== "" ? v.trim().toUpperCase() : null,
    z.string().max(40).nullable().optional(),
  ),
});

export type CreateSaleInput = z.infer<typeof createSaleSchema>;
export type SaleItemInput = z.infer<typeof saleItemSchema>;

// ────────────────────────────────────────────────────────────────────
// Coupons
// ────────────────────────────────────────────────────────────────────

/**
 * What the owner types in the create-coupon form. Code is optional —
 * we auto-generate when missing. Value semantics depend on type:
 *   FIXED   → RWF off the matched line(s); must be >= 1
 *   PERCENT → percent (1..100); stored as basis points (×100) in DB
 */
export const createCouponSchema = z
  .object({
    code: z.preprocess(
      (v) =>
        typeof v === "string" && v.trim() !== ""
          ? v.trim().toUpperCase()
          : null,
      z
        .string()
        .min(4, "Code must be at least 4 characters")
        .max(20, "Code must be at most 20 characters")
        .regex(/^[A-Z0-9]+$/, "Letters and digits only")
        .nullable()
        .optional(),
    ),
    type: z.enum(["FIXED", "PERCENT"]),
    value: z.coerce
      .number({ invalid_type_error: "Value is required" })
      .int("Value must be a whole number")
      .min(1, "Value must be at least 1"),
    productId: z.preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? null : v),
      z.string().nullable().optional(),
    ),
    expiresInDays: z.coerce
      .number({ invalid_type_error: "Expiry days required" })
      .int()
      .min(1, "Expiry must be at least 1 day")
      .max(365, "Expiry can be at most 365 days")
      .default(7),
    allowFloorOverride: z.coerce.boolean().default(false),
    notes: z.preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? null : v),
      z.string().trim().max(500).nullable().optional(),
    ),
  })
  .refine((v) => v.type !== "PERCENT" || v.value <= 100, {
    message: "Percent coupons must be between 1 and 100",
    path: ["value"],
  });

export type CreateCouponInput = z.infer<typeof createCouponSchema>;
