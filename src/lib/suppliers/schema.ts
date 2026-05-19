import { z } from "zod";

// Same loose phone format as users — 7-20 digits, optional +.
const phonePattern = /^\+?\d{7,20}$/;

const optionalPhone = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z
    .string()
    .trim()
    .regex(phonePattern, "Phone must be 7-20 digits (optionally starting with +)")
    .optional(),
);

const optionalNotes = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.string().trim().max(2000).optional(),
);

export const supplierCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  phone: optionalPhone,
  notes: optionalNotes,
});

export const supplierUpdateSchema = supplierCreateSchema;

export type SupplierCreateInput = z.infer<typeof supplierCreateSchema>;
export type SupplierUpdateInput = z.infer<typeof supplierUpdateSchema>;
