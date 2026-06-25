import { z } from "zod";

const skuPattern = /^[A-Z0-9][A-Z0-9._-]{0,49}$/i;

const positiveInt = (label: string) =>
  z.coerce
    .number({ invalid_type_error: `${label} must be a number` })
    .int(`${label} must be a whole number`)
    .min(0, `${label} cannot be negative`);

const optionalString = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? null : v),
  z.string().min(1).nullable().optional(),
);

const optionalEmoji = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? null : v),
  z.string().trim().max(10).nullable().optional(),
);

const optionalIconKey = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? null : v),
  z.string().trim().max(50).nullable().optional(),
);

const baseFields = {
  name: z.string().trim().min(1, "Name is required").max(200),
  categoryId: optionalString,
  iconKey: optionalIconKey,
  iconEmoji: optionalEmoji,
  unitsPerCarton: positiveInt("Units per carton").min(
    1,
    "Units per carton must be at least 1",
  ),
  costPerCarton: positiveInt("Cost per carton"),
  unitPrice: positiveInt("Unit price"),
  cartonPrice: positiveInt("Carton price"),
  sellableAsUnit: z.boolean().default(true),
  sellableAsCarton: z.boolean().default(true),
  lowStockThresholdUnits: positiveInt("Low-stock threshold").default(0),
  /// Minimum profit margin in basis points (10000 = 100%) — the floor
  /// for ad-hoc discounts. 0 means "use the global default".
  minMarginBps: positiveInt("Minimum margin")
    .max(10000, "Minimum margin cannot exceed 100%")
    .default(0),
  loyaltyPointsPerUnit: positiveInt("Loyalty points per unit").default(0),
};

const sellableRule = (
  data: { sellableAsUnit: boolean; sellableAsCarton: boolean },
  ctx: z.RefinementCtx,
) => {
  if (!data.sellableAsUnit && !data.sellableAsCarton) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Product must be sellable as unit, carton, or both",
      path: ["sellableAsUnit"],
    });
  }
};

export const productCreateSchema = z
  .object({
    sku: z
      .string()
      .trim()
      .min(1, "SKU is required")
      .max(50)
      .regex(
        skuPattern,
        "SKU must start with a letter or digit; allowed characters: A-Z 0-9 . _ -",
      ),
    ...baseFields,
  })
  .superRefine(sellableRule);

export const productUpdateSchema = z.object(baseFields).superRefine(sellableRule);

export const productArchiveSchema = z.object({
  id: z.string().min(1, "Product id is required"),
});

export type ProductCreateInput = z.infer<typeof productCreateSchema>;
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;
