"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ImagePlus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  removeLogo,
  updateSettings,
  uploadLogo,
} from "@/lib/settings/actions";
import {
  THEMES,
  THEME_KEYS,
  type ThemeKey,
} from "@/lib/settings/schema";

type Initial = {
  companyName: string;
  theme: ThemeKey;
  logoUrl: string | null;
  defaultMinMarginBps: number;
};

export function SettingsForm({ initial }: { initial: Initial }) {
  const router = useRouter();
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const [companyName, setCompanyName] = useState(initial.companyName);
  const [theme, setTheme] = useState<ThemeKey>(initial.theme);
  // Stored in basis points (10000 = 100%) but shown as a percentage for
  // humans. Empty string while editing is allowed; converted on submit.
  const [defaultMarginPct, setDefaultMarginPct] = useState<string>(
    initial.defaultMinMarginBps > 0
      ? String(initial.defaultMinMarginBps / 100)
      : "",
  );
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();
  const [idempotencyKey, setIdempotencyKey] = useState(() =>
    crypto.randomUUID(),
  );

  function handleSubmit() {
    setError(null);
    setSavedAt(null);
    startTransition(async () => {
      const pct = Number(defaultMarginPct);
      const defaultMinMarginBps =
        defaultMarginPct.trim() === "" || Number.isNaN(pct)
          ? 0
          : Math.max(0, Math.min(10000, Math.round(pct * 100)));
      const result = await updateSettings(idempotencyKey, {
        companyName,
        theme,
        defaultMinMarginBps,
      });
      if (!result.ok) {
        setError(result.error);
        setIdempotencyKey(crypto.randomUUID());
        return;
      }
      setSavedAt(Date.now());
      setIdempotencyKey(crypto.randomUUID());
      router.refresh();
    });
  }

  return (
    <form action={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {savedAt && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {t("refreshTabs")}
        </div>
      )}

      <section
        data-tour="settings-name"
        className="rounded-2xl border border-zinc-200 bg-white p-4"
      >
        <h2 className="text-base font-medium">{t("shopName")}</h2>
        <p className="mt-0.5 text-xs text-zinc-600">{t("shopNameHint")}</p>
        <input
          type="text"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          maxLength={80}
          required
          className="mt-3 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          placeholder="HydroMart Shop"
        />
      </section>

      <section
        data-tour="settings-theme"
        className="rounded-2xl border border-zinc-200 bg-white p-4"
      >
        <h2 className="text-base font-medium">{t("theme")}</h2>
        <p className="mt-0.5 text-xs text-zinc-600">{t("themeHint")}</p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {THEME_KEYS.map((key) => {
            const themeMeta = THEMES[key];
            const selected = theme === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setTheme(key)}
                aria-pressed={selected}
                aria-label={themeMeta.label}
                title={themeMeta.label}
                className={`group flex flex-col items-center gap-1.5 rounded-xl border p-2 text-center transition ${
                  selected
                    ? "border-zinc-900 ring-2 ring-zinc-900"
                    : "border-zinc-200 hover:border-zinc-400"
                }`}
              >
                <span
                  aria-hidden
                  className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-zinc-200 shadow-inner"
                  style={{ background: themeMeta.preview }}
                >
                  {selected && (
                    <Check
                      className="h-5 w-5 text-zinc-900"
                      strokeWidth={3}
                    />
                  )}
                </span>
                <span className="text-xs font-medium text-zinc-700">
                  {themeMeta.label}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section
        data-tour="settings-discount-floor"
        className="rounded-2xl border border-zinc-200 bg-white p-4"
      >
        <h2 className="text-base font-medium">{t("discountFloor")}</h2>
        <p className="mt-0.5 text-xs text-zinc-600">
          {t("discountFloorHint")}
        </p>
        <div className="mt-3 flex items-end gap-3">
          <label className="block flex-1">
            <span className="text-xs text-zinc-600">
              {t("discountFloorLabel")}
            </span>
            <div className="relative mt-1">
              <input
                type="number"
                min={0}
                max={100}
                step="0.1"
                value={defaultMarginPct}
                onChange={(e) => setDefaultMarginPct(e.target.value)}
                placeholder="0"
                className="block w-full rounded-lg border border-zinc-300 pl-3 pr-8 py-2 text-sm"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">
                %
              </span>
            </div>
          </label>
        </div>
        <p className="mt-2 text-[11px] text-zinc-500">
          {t("discountFloorExample")}
        </p>
      </section>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
        >
          {isPending ? `${tc("save")}…` : tc("save")}
        </button>
      </div>

      <LogoSection initialLogoUrl={initial.logoUrl} />
    </form>
  );
}

function LogoSection({ initialLogoUrl }: { initialLogoUrl: string | null }) {
  const router = useRouter();
  const t = useTranslations("settings");
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialLogoUrl);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onPick(file: File) {
    setError(null);
    const formData = new FormData();
    formData.append("logo", file);
    const localPreview = URL.createObjectURL(file);
    setPreviewUrl(localPreview);
    startTransition(async () => {
      const result = await uploadLogo(formData);
      if (!result.ok) {
        setError(result.error);
        setPreviewUrl(initialLogoUrl);
        return;
      }
      router.refresh();
    });
  }

  function onRemove() {
    setError(null);
    startTransition(async () => {
      const result = await removeLogo();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setPreviewUrl(null);
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    });
  }

  return (
    <section
      data-tour="settings-logo"
      className="rounded-2xl border border-zinc-200 bg-white p-4"
    >
      <h2 className="text-base font-medium">{t("logo")}</h2>
      <p className="mt-0.5 text-xs text-zinc-600">{t("logoHint")}</p>

      {error && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      <div className="mt-3 flex items-center gap-4">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt="Logo preview"
              className="max-h-16 max-w-16 object-contain"
            />
          ) : (
            <ImagePlus className="h-7 w-7 text-zinc-400" strokeWidth={1.5} />
          )}
        </div>
        <div className="flex flex-1 flex-wrap gap-2">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm hover:bg-zinc-50">
            <ImagePlus className="h-4 w-4" strokeWidth={1.5} />
            <span>{previewUrl ? t("replaceLogo") : t("uploadLogo")}</span>
            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="hidden"
              disabled={isPending}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onPick(f);
              }}
            />
          </label>
          {previewUrl && (
            <button
              type="button"
              onClick={onRemove}
              disabled={isPending}
              className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:opacity-60"
            >
              <Trash2 className="h-4 w-4" strokeWidth={1.5} />
              {t("remove")}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
