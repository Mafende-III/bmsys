import { z } from "zod";

/**
 * A single per-product per-channel price override row from the form.
 * - `null` (or omitted) for a price means "no override — fall back to
 *   the product's default unitPrice/cartonPrice".
 * - A non-negative integer means "use this price on this channel".
 */
const optionalPrice = z
  .union([z.literal(""), z.null(), z.coerce.number().int().min(0)])
  .transform((v) => (v === "" || v === null ? null : v));

const overrideEntry = z.object({
  channelId: z.string().min(1, "Channel id is required"),
  unitPrice: optionalPrice,
  cartonPrice: optionalPrice,
});

export const upsertPriceOverridesSchema = z.object({
  productId: z.string().min(1, "Product id is required"),
  overrides: z.array(overrideEntry),
});

export type PriceOverrideInput = z.infer<typeof overrideEntry>;
export type UpsertPriceOverridesInput = z.infer<typeof upsertPriceOverridesSchema>;
