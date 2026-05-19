import { z } from "zod";

const positiveInt = (label: string) =>
  z.coerce
    .number({ invalid_type_error: `${label} must be a number` })
    .int(`${label} must be a whole number`)
    .min(1, `${label} must be at least 1`);

const optionalText = (max = 200) =>
  z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? null : v),
    z.string().trim().max(max).nullable().optional(),
  );

export const PAYMENT_METHODS = ["CASH", "MOMO", "BANK"] as const;
export type ExpensePaymentMethod = (typeof PAYMENT_METHODS)[number];

export const createExpenseSchema = z.object({
  date: z.coerce.date(),
  amount: positiveInt("Amount"),
  categoryId: z.string().min(1, "Category is required"),
  description: z.string().trim().min(1, "Description is required").max(500),
  paymentMethod: z.enum(PAYMENT_METHODS),
  paymentReference: optionalText(),
  supplierId: optionalText(),
});

export const RECURRING_FREQUENCIES = ["WEEKLY", "MONTHLY"] as const;
export type RecurringFrequency = (typeof RECURRING_FREQUENCIES)[number];

export const recurringSchema = z
  .object({
    categoryId: z.string().min(1, "Category is required"),
    amount: positiveInt("Amount"),
    description: z.string().trim().min(1, "Description is required").max(500),
    frequency: z.enum(RECURRING_FREQUENCIES),
    dayOfPeriod: z.coerce
      .number({ invalid_type_error: "Day must be a number" })
      .int("Day must be a whole number")
      .min(0, "Day cannot be negative")
      .max(31, "Day cannot exceed 31"),
    active: z.coerce.boolean().default(true),
  })
  .superRefine((data, ctx) => {
    if (data.frequency === "WEEKLY" && data.dayOfPeriod > 6) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Day of week must be 0 (Sun) to 6 (Sat)",
        path: ["dayOfPeriod"],
      });
    }
    if (data.frequency === "MONTHLY" && data.dayOfPeriod < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Day of month must be 1-31",
        path: ["dayOfPeriod"],
      });
    }
  });

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type RecurringInput = z.infer<typeof recurringSchema>;
