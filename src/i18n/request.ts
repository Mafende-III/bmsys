import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { getSavedLocale } from "@/lib/i18n/actions";
import { LOCALE_COOKIE, isLocale } from "./config";

/**
 * Server-side locale resolution. Resolution order:
 *   1. `lang` cookie (set by the LanguageToggle for instant flips)
 *   2. User's saved language column (so the choice follows them
 *      across devices on first sign-in from a new device)
 *   3. Default ("en")
 */
export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const raw = cookieStore.get(LOCALE_COOKIE)?.value;
  const locale = isLocale(raw) ? raw : await getSavedLocale();
  const messages = (await import(`../../messages/${locale}.json`)).default;
  return { locale, messages };
});
