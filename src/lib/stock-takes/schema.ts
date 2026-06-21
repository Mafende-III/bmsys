import { z } from "zod";

/**
 * One line of a stock-take submission. countedUnits is the physical
 * count entered by the owner; the operation computes the variance
 * against the system's derived stock and writes a signed StockMove.
 */
export const stockTakeLineSchema = z.object({
  productId: z.string().min(1),
  countedUnits: z.coerce
    .number({ invalid_type_error: "Counted units must be a number" })
    .int("Counted units must be a whole number")
    .min(0, "Counted units cannot be negative"),
});

export const stockTakeSchema = z.object({
  note: z
    .string()
    .trim()
    .min(1, "Add a short note explaining the stock-take")
    .max(2000),
  lines: z.array(stockTakeLineSchema).min(1, "No products to count"),
});

export type StockTakeInput = z.infer<typeof stockTakeSchema>;
export type StockTakeLineInput = z.infer<typeof stockTakeLineSchema>;
