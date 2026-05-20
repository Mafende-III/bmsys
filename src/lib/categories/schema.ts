import { z } from "zod";

const slugPattern = /^[a-z0-9](?:[a-z0-9-]{0,48}[a-z0-9])?$/;

const optionalIconKey = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? null : v),
  z.string().trim().max(50).nullable().optional(),
);

export const categoryCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Slug is required")
    .max(50)
    .regex(
      slugPattern,
      "Slug must be lowercase letters, digits, and dashes (e.g. soft-drinks)",
    ),
  iconKey: optionalIconKey,
  iconEmoji: z
    .string()
    .trim()
    .min(1, "Icon is required")
    .max(10, "Icon should be a single emoji"),
  sortOrder: z.coerce.number().int().default(0),
});

// Slug is immutable after creation (referenced in URLs).
export const categoryUpdateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  iconKey: optionalIconKey,
  iconEmoji: z.string().trim().min(1).max(10),
  sortOrder: z.coerce.number().int().default(0),
  active: z.preprocess(
    (v) => v === "on" || v === true || v === "true",
    z.boolean(),
  ),
});

export type CategoryCreateInput = z.infer<typeof categoryCreateSchema>;
export type CategoryUpdateInput = z.infer<typeof categoryUpdateSchema>;
