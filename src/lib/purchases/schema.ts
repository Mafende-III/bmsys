import { z } from "zod";

const positiveInt = (label: string) =>
  z.coerce
    .number({ invalid_type_error: `${label} must be a number` })
    .int(`${label} must be a whole number`)
    .min(0, `${label} cannot be negative`);

export const purchaseLineSchema = z
  .object({
    productId: z.string().min(1, "Product is required"),
    qtyCartons: positiveInt("Cartons").default(0),
    qtyLooseUnits: positiveInt("Loose units").default(0),
    unitCost: positiveInt("Cost per carton"),
  })
  .refine((l) => l.qtyCartons > 0 || l.qtyLooseUnits > 0, {
    message: "Each line needs at least one carton or loose unit",
    path: ["qtyCartons"],
  });

export const savePurchaseDraftSchema = z.object({
  supplierId: z.string().min(1, "Supplier is required"),
  date: z.coerce.date(),
  note: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? null : v),
    z.string().trim().max(2000).nullable().optional(),
  ),
  lines: z.array(purchaseLineSchema),
});

export const purchaseIdSchema = z.object({
  id: z.string().min(1, "Purchase id is required"),
});

export type PurchaseLineInput = z.infer<typeof purchaseLineSchema>;
export type SavePurchaseDraftInput = z.infer<typeof savePurchaseDraftSchema>;
