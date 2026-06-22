import { z } from "zod";

/**
 * One line of a stock-take submission. The owner counts the physical
 * stock as two pieces: how many sealed cartons are on the shelf, and
 * how many loose units are sitting outside cartons (open packets,
 * single bottles, etc.). The operation multiplies cartons by the
 * product's unitsPerCarton and adds loose to get the counted total,
 * then writes the signed variance against the system's total.
 */
export const stockTakeLineSchema = z.object({
  productId: z.string().min(1),
  countedCartons: z.coerce
    .number({ invalid_type_error: "Cartons must be a number" })
    .int("Cartons must be a whole number")
    .min(0, "Cartons cannot be negative"),
  countedLooseUnits: z.coerce
    .number({ invalid_type_error: "Loose units must be a number" })
    .int("Loose units must be a whole number")
    .min(0, "Loose units cannot be negative"),
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
