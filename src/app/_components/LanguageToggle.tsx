"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Languages } from "lucide-react";
import { LOCALES, LOCALE_COOKIE, LOCALE_LABEL, type Locale } from "@/i18n/config";

/**
 * Compact EN ↔ RW switcher. Writes the chosen locale into a cookie
 * and refreshes so the server-rendered tree re-renders with the new
 * messages bundle. Per-device (cookie scoped to the host).
 */
export function LanguageToggle({ current }: { current: Locale }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function setLocale(next: Locale) {
    if (next === current || isPending) return;
    // 365 days, scoped to root, lax SameSite for normal page nav.
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    startTransition(() => router.refresh());
  }

  return (
    <div
      className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 bg-white p-0.5 text-xs"
      role="group"
      aria-label="Language"
    >
      <Languages className="mx-1 h-3.5 w-3.5 text-zinc-500" strokeWidth={2} />
      {LOCALES.map((loc) => {
        const active = loc === current;
        return (
          <button
            key={loc}
            type="button"
            onClick={() => setLocale(loc)}
            disabled={isPending}
            aria-pressed={active}
            title={LOCALE_LABEL[loc]}
            className={`rounded-md px-2 py-1 font-medium transition disabled:opacity-60 ${
              active
                ? "bg-zinc-900 text-white"
                : "text-zinc-700 hover:bg-zinc-100"
            }`}
          >
            {loc.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}
