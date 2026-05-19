import { z } from "zod";

// Lowercase, kebab-case, must start and end with alphanumeric.
const slugPattern = /^[a-z0-9](?:[a-z0-9-]{0,48}[a-z0-9])?$/;

export const channelCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Slug is required")
    .max(50)
    .regex(
      slugPattern,
      "Slug must be lowercase letters, digits, and dashes (e.g. wholesale-premium)",
    ),
});

// Slug is immutable after creation — it's referenced in URLs, reports,
// and external integrations. Name can change freely.
export const channelUpdateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
});

export const channelDeactivateSchema = z.object({
  id: z.string().min(1, "Channel id is required"),
});

export type ChannelCreateInput = z.infer<typeof channelCreateSchema>;
export type ChannelUpdateInput = z.infer<typeof channelUpdateSchema>;
