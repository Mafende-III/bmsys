"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ImagePlus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Card, CaptionLabel } from "@/components/ui";
import { cn } from "@/lib/cn";
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

const FIELD =
  "block w-full rounded-panel border border-rule bg-surface px-3 text-sm text-ink focus:border-rule-active focus:outline-none focus:ring-1 focus:ring-rule-active";

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
    <form action={handleSubmit} className="space-y-3">
      {error && (
        <div className="rounded-panel bg-error-wash px-3.5 py-2.5 text-sm font-semibold text-error">
          {error}
        </div>
      )}
      {savedAt && (
        <div className="flex items-center gap-2 rounded-panel bg-success-wash px-3.5 py-2.5 text-sm font-semibold text-success">
          <Check className="h-4 w-4 shrink-0" strokeWidth={2.6} />
          {t("refreshTabs")}
        </div>
      )}

      <Card data-tour="settings-name" className="p-4">
        <CaptionLabel>{t("shopName")}</CaptionLabel>
        <p className="mt-0.5 text-xs text-ink-2">{t("shopNameHint")}</p>
        <input
          type="text"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          maxLength={80}
          required
          className={cn(FIELD, "mt-3 h-11")}
          placeholder="HydroMart Shop"
        />
      </Card>

      <Card data-tour="settings-theme" className="p-4">
        <CaptionLabel>{t("theme")}</CaptionLabel>
        <p className="mt-0.5 text-xs text-ink-2">{t("themeHint")}</p>
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
                className={cn(
                  "group flex flex-col items-center gap-1.5 rounded-sheet p-2 text-center transition",
                  selected
                    ? "ring-2 ring-inset ring-ink"
                    : "ring-1 ring-inset ring-rule-hair hover:ring-rule",
                )}
              >
                <span
                  aria-hidden
                  className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full ring-1 ring-inset ring-rule shadow-inner"
                  style={{ background: themeMeta.preview }}
                >
                  {selected && (
                    <Check className="h-5 w-5 text-ink" strokeWidth={3} />
                  )}
                </span>
                <span
                  className={cn(
                    "text-xs",
                    selected ? "font-bold text-ink" : "font-semibold text-ink-2",
                  )}
                >
                  {themeMeta.label}
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      <Card data-tour="settings-discount-floor" className="p-4">
        <CaptionLabel>{t("discountFloor")}</CaptionLabel>
        <p className="mt-0.5 text-xs text-ink-2">{t("discountFloorHint")}</p>
        <div className="mt-3 flex items-end gap-3">
          <label className="block flex-1">
            <CaptionLabel>{t("discountFloorLabel")}</CaptionLabel>
            <div className="relative mt-1.5">
              <input
                type="number"
                min={0}
                max={100}
                step="0.1"
                inputMode="decimal"
                value={defaultMarginPct}
                onChange={(e) => setDefaultMarginPct(e.target.value)}
                placeholder="0"
                className={cn(
                  FIELD,
                  "num h-11 pr-9 text-right text-base font-semibold",
                )}
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-ink-2">
                %
              </span>
            </div>
          </label>
        </div>
        <p className="mt-2 text-[11px] text-ink-2">
          {t("discountFloorExample")}
        </p>
      </Card>

      <button
        type="submit"
        disabled={isPending}
        className="h-12 w-full rounded-full bg-fab px-4 text-sm font-bold text-white shadow-fab active:translate-y-[2px] disabled:opacity-60"
      >
        {isPending ? `${tc("save")}…` : tc("save")}
      </button>

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
    <Card data-tour="settings-logo" className="p-4">
      <CaptionLabel>{t("logo")}</CaptionLabel>
      <p className="mt-0.5 text-xs text-ink-2">{t("logoHint")}</p>

      {error && (
        <div className="mt-3 rounded-panel bg-error-wash px-3.5 py-2.5 text-xs font-semibold text-error">
          {error}
        </div>
      )}

      <div className="mt-3 flex items-center gap-4">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-sheet bg-surface-sunk ring-1 ring-inset ring-rule-hair">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt="Logo preview"
              className="max-h-16 max-w-16 object-contain"
            />
          ) : (
            <ImagePlus className="h-7 w-7 text-ink-2" strokeWidth={1.5} />
          )}
        </div>
        <div className="flex flex-1 flex-wrap gap-2">
          <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-full bg-surface px-4 text-sm font-bold text-primary ring-1 ring-inset ring-rule">
            <ImagePlus className="h-4 w-4" strokeWidth={2} />
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
              className="inline-flex h-10 items-center gap-2 rounded-full bg-surface px-4 text-sm font-bold text-error ring-1 ring-inset ring-rule disabled:opacity-60"
            >
              <Trash2 className="h-4 w-4" strokeWidth={2} />
              {t("remove")}
            </button>
          )}
        </div>
      </div>
    </Card>
  );
}
