/**
 * Single-tenant locale config. The app supports English (default)
 * and Kinyarwanda; the choice is stored in a `lang` cookie set by
 * the LanguageToggle client component. No URL prefixes — keeps
 * bookmarks and the auth flow simple.
 */

export const LOCALES = ["en", "rw"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

export const LOCALE_COOKIE = "lang";

export const LOCALE_LABEL: Record<Locale, string> = {
  en: "English",
  rw: "Kinyarwanda",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}
