import { z } from "zod";

export const saleItemSchema = z
  .object({
    productId: z.string().min(1, "Product id is required"),
    saleUnit: z.enum(["UNIT", "CARTON"]),
    qty: z.coerce
      .number({ invalid_type_error: "Qty must be a number" })
      .int("Qty must be a whole number")
      .min(1, "Qty must be at least 1"),
    /// Absolute RWF discount applied to the whole line (qty already
    /// multiplied in). 0 = no discount. Always >= 0.
    discountAmount: z.coerce
      .number({ invalid_type_error: "Discount must be a number" })
      .int("Discount must be a whole number")
      .min(0, "Discount cannot be negative")
      .default(0),
    /// Short human reason for the discount. Required when discountAmount > 0.
    discountReason: z.preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? null : v),
      z.string().trim().max(200).nullable().optional(),
    ),
    /// Owner explicitly bypassed the min-margin floor. Only respected
    /// when the calling user is OWNER; sellers cannot override.
    floorOverride: z.coerce.boolean().default(false),
  })
  .refine((v) => v.discountAmount === 0 || (v.discountReason ?? "") !== "", {
    message: "Add a reason when applying a discount",
    path: ["discountReason"],
  });

export const createSaleSchema = z.object({
  channelId: z.string().min(1, "Channel is required"),
  paymentMethod: z.enum(["CASH", "MOMO", "BANK"]),
  paymentReference: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? null : v),
    z.string().trim().max(200).nullable().optional(),
  ),
  items: z.array(saleItemSchema).min(1, "Add at least one item"),
});

export type CreateSaleInput = z.infer<typeof createSaleSchema>;
export type SaleItemInput = z.infer<typeof saleItemSchema>;
