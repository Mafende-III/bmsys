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
});

export type CreateSaleInput = z.infer<typeof createSaleSchema>;
export type SaleItemInput = z.infer<typeof saleItemSchema>;
