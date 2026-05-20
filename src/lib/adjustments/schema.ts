import { z } from "zod";

export const ADJUSTMENT_REASONS = [
  "ADJUSTMENT_BREAKAGE",
  "ADJUSTMENT_EXPIRY",
  "ADJUSTMENT_PERSONAL",
  "ADJUSTMENT_THEFT",
  "ADJUSTMENT_SAMPLE",
] as const;

export type AdjustmentReason = (typeof ADJUSTMENT_REASONS)[number];

export const createAdjustmentSchema = z.object({
  productId: z.string().min(1, "Product is required"),
  reason: z.enum(ADJUSTMENT_REASONS),
  qtyUnits: z.coerce
    .number({ invalid_type_error: "Qty must be a number" })
    .int("Qty must be a whole number")
    .min(1, "Qty must be at least 1"),
  note: z
    .string()
    .trim()
    .min(1, "A note is required for every adjustment")
    .max(2000),
});

export type CreateAdjustmentInput = z.infer<typeof createAdjustmentSchema>;
