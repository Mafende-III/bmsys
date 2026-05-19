import { z } from "zod";

// PIN: 4-6 digits. Stored as argon2 hash, never the raw value.
const pinPattern = /^\d{4,6}$/;

// Phone: simple sanity check — at least 7 chars, allow digits and +.
const phonePattern = /^\+?\d{7,20}$/;

const allowedChannelIds = z
  .preprocess(
    (v) => {
      // Form sends a single string or array depending on browser; normalize.
      if (Array.isArray(v)) return v;
      if (typeof v === "string" && v !== "") return [v];
      return [];
    },
    z.array(z.string().min(1)).default([]),
  );

export const userCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  phone: z
    .string()
    .trim()
    .regex(phonePattern, "Phone must be 7-20 digits (optionally starting with +)"),
  pin: z.string().regex(pinPattern, "PIN must be 4-6 digits"),
  role: z.enum(["OWNER", "SELLER"]),
  allowedChannelIds,
});

export const userUpdateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  role: z.enum(["OWNER", "SELLER"]),
  active: z.preprocess(
    (v) => v === "on" || v === true || v === "true",
    z.boolean(),
  ),
  allowedChannelIds,
  resetPin: z
    .preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
      z.string().regex(pinPattern, "PIN must be 4-6 digits").optional(),
    ),
});

export type UserCreateInput = z.infer<typeof userCreateSchema>;
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;
