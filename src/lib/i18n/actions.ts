"use server";

import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  isLocale,
  type Locale,
} from "@/i18n/config";

/**
 * Sets the locale cookie and, if the user is signed in, persists
 * the choice on their User row so it follows them across devices.
 * The cookie is still written so the next render uses it without a
 * round-trip to the DB.
 */
export async function setLanguage(next: Locale): Promise<void> {
  if (!isLocale(next)) return;

  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, next, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });

  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (userId) {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: { language: next },
      });
    } catch {
      // ignore — cookie still set
    }
  }
}

/**
 * Returns the user's saved locale if signed in, otherwise the
 * default. Read by getRequestConfig as a fallback when no cookie
 * is present (e.g. a brand-new device after sign-in).
 */
export async function getSavedLocale(): Promise<Locale> {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return DEFAULT_LOCALE;
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { language: true },
    });
    if (user?.language && isLocale(user.language)) return user.language;
  } catch {
    // ignore
  }
  return DEFAULT_LOCALE;
}
