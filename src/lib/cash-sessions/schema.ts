import { z } from "zod";

const positiveInt = (label: string) =>
  z.coerce
    .number({ invalid_type_error: `${label} must be a number` })
    .int(`${label} must be a whole number`)
    .min(0, `${label} cannot be negative`);

const optionalNote = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? null : v),
  z.string().trim().max(2000).nullable().optional(),
);

export const openCashSessionSchema = z.object({
  openingFloat: positiveInt("Opening float"),
  note: optionalNote,
});

export const closeCashSessionSchema = z.object({
  closingCount: positiveInt("Closing count"),
  note: optionalNote,
});

export type OpenCashSessionInput = z.infer<typeof openCashSessionSchema>;
export type CloseCashSessionInput = z.infer<typeof closeCashSessionSchema>;
