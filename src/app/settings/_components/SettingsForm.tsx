"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ImagePlus, Trash2 } from "lucide-react";
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
};

export function SettingsForm({ initial }: { initial: Initial }) {
  const router = useRouter();
  const [companyName, setCompanyName] = useState(initial.companyName);
  const [theme, setTheme] = useState<ThemeKey>(initial.theme);
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
      const result = await updateSettings(idempotencyKey, {
        companyName,
        theme,
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
          Saved. Refresh other tabs to see the new look.
        </div>
      )}

      <section
        data-tour="settings-name"
        className="rounded-2xl border border-zinc-200 bg-white p-4"
      >
        <h2 className="text-base font-medium">Shop name</h2>
        <p className="mt-0.5 text-xs text-zinc-600">
          Shown on the sign-in screen and in the browser tab.
        </p>
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
        <h2 className="text-base font-medium">Theme</h2>
        <p className="mt-0.5 text-xs text-zinc-600">
          Picks the background colour across the app. Content stays
          high-contrast either way.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {THEME_KEYS.map((key) => {
            const t = THEMES[key];
            const selected = theme === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setTheme(key)}
                aria-pressed={selected}
                className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${
                  selected
                    ? "border-zinc-900 ring-2 ring-zinc-900"
                    : "border-zinc-200 hover:border-zinc-400"
                }`}
              >
                <span
                  aria-hidden
                  className="block h-10 w-10 shrink-0 rounded-lg border border-zinc-200"
                  style={{ background: t.preview }}
                />
                <span className="flex-1 text-sm font-medium text-zinc-800">
                  {t.label}
                </span>
                {selected && (
                  <Check className="h-4 w-4 text-zinc-900" strokeWidth={2.5} />
                )}
              </button>
            );
          })}
        </div>
      </section>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
        >
          {isPending ? "Saving…" : "Save changes"}
        </button>
      </div>

      <LogoSection initialLogoUrl={initial.logoUrl} />
    </form>
  );
}

function LogoSection({ initialLogoUrl }: { initialLogoUrl: string | null }) {
  const router = useRouter();
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
      <h2 className="text-base font-medium">Logo</h2>
      <p className="mt-0.5 text-xs text-zinc-600">
        Shown on the sign-in screen, in the top bar, and as the browser tab
        icon. PNG or SVG with a transparent background works best. Max 2 MB.
      </p>

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
            <span>{previewUrl ? "Replace logo" : "Upload logo"}</span>
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
              Remove
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
