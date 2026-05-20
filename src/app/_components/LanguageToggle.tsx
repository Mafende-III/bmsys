"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Languages } from "lucide-react";
import { setLanguage } from "@/lib/i18n/actions";
import { LOCALES, LOCALE_LABEL, type Locale } from "@/i18n/config";

/**
 * Compact EN ↔ RW switcher. The server action both sets the cookie
 * (so the next render is instant) and — when signed in — persists
 * the choice on the User row so it follows the user across devices.
 */
export function LanguageToggle({ current }: { current: Locale }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function setLocale(next: Locale) {
    if (next === current || isPending) return;
    startTransition(async () => {
      await setLanguage(next);
      router.refresh();
    });
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
