import { z } from "zod";

export const THEME_KEYS = ["default", "sky", "light-blue"] as const;
export type ThemeKey = (typeof THEME_KEYS)[number];

export const THEMES: Record<ThemeKey, { label: string; preview: string }> = {
  default: { label: "Default (white)", preview: "#ffffff" },
  sky: { label: "Sky blue", preview: "#0ea5e9" },
  "light-blue": { label: "Light blue", preview: "#bae6fd" },
};

export const settingsUpdateSchema = z.object({
  companyName: z.string().trim().min(1, "Company name is required").max(80),
  theme: z.enum(THEME_KEYS),
});

export type SettingsUpdateInput = z.infer<typeof settingsUpdateSchema>;
