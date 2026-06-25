import { z } from "zod";

/**
 * Curated palette. Each entry tints the app's chrome a single soft
 * hue while keeping content panels white so forms and tables stay
 * easy to read. To add a colour: append a key here AND a matching
 * `[data-theme="…"]` block in src/app/globals.css.
 */
export const THEME_KEYS = [
  "default",
  "sky",
  "blue",
  "indigo",
  "violet",
  "rose",
  "amber",
  "emerald",
  "teal",
  "slate",
] as const;
export type ThemeKey = (typeof THEME_KEYS)[number];

export const THEMES: Record<ThemeKey, { label: string; preview: string }> = {
  default: { label: "Neutral", preview: "#fafafa" },
  sky: { label: "Sky", preview: "#7dd3fc" },
  blue: { label: "Blue", preview: "#93c5fd" },
  indigo: { label: "Indigo", preview: "#a5b4fc" },
  violet: { label: "Violet", preview: "#c4b5fd" },
  rose: { label: "Rose", preview: "#fda4af" },
  amber: { label: "Amber", preview: "#fcd34d" },
  emerald: { label: "Emerald", preview: "#6ee7b7" },
  teal: { label: "Teal", preview: "#5eead4" },
  slate: { label: "Slate", preview: "#cbd5e1" },
};

export const settingsUpdateSchema = z.object({
  companyName: z.string().trim().min(1, "Company name is required").max(80),
  theme: z.enum(THEME_KEYS),
  /// Shop-wide fallback discount floor, in basis points (10000 = 100%).
  /// Applied when a product leaves its own minMarginBps at 0.
  defaultMinMarginBps: z.coerce
    .number({ invalid_type_error: "Default margin must be a number" })
    .int("Default margin must be a whole number")
    .min(0, "Default margin cannot be negative")
    .max(10000, "Default margin cannot exceed 100%")
    .default(0),
});

export type SettingsUpdateInput = z.infer<typeof settingsUpdateSchema>;
