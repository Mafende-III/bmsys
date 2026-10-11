"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { Card, CaptionLabel } from "@/components/ui";
import { cn } from "@/lib/cn";
import { updateMyProfile } from "@/lib/users/actions";
import type { Locale } from "@/i18n/config";
import { LanguageToggle } from "@/app/_components/LanguageToggle";

type Initial = {
  name: string;
  phone: string;
  role: "OWNER" | "SELLER";
  language: Locale;
};

const FIELD =
  "mt-1.5 block h-11 w-full rounded-panel border border-rule bg-surface px-3 text-sm text-ink focus:border-rule-active focus:outline-none focus:ring-1 focus:ring-rule-active";

export function ProfileForm({ initial }: { initial: Initial }) {
  const router = useRouter();
  const t = useTranslations("profile");
  const tc = useTranslations("common");
  const tu = useTranslations("users");

  const [name, setName] = useState(initial.name);
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
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
      const result = await updateMyProfile(idempotencyKey, {
        name,
        currentPin,
        newPin,
        confirmPin,
      });
      if (!result.ok) {
        setError(result.error);
        setIdempotencyKey(crypto.randomUUID());
        return;
      }
      setSavedAt(Date.now());
      setIdempotencyKey(crypto.randomUUID());
      setCurrentPin("");
      setNewPin("");
      setConfirmPin("");
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
          {tc("saved")}
        </div>
      )}

      <Card data-tour="profile-identity" className="space-y-3 p-4">
        <label className="block">
          <CaptionLabel>{t("name")}</CaptionLabel>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={100}
            className={FIELD}
          />
        </label>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <CaptionLabel>{t("phone")}</CaptionLabel>
            <input
              type="tel"
              value={initial.phone}
              disabled
              className={cn(FIELD, "num bg-ground text-ink-2")}
            />
            <span className="mt-1 block text-xs text-ink-2">
              {t("phoneNote")}
            </span>
          </label>
          <label className="block">
            <CaptionLabel>{t("role")}</CaptionLabel>
            <input
              type="text"
              value={
                initial.role === "OWNER" ? tu("roleOwner") : tu("roleSeller")
              }
              disabled
              className={cn(FIELD, "bg-ground text-ink-2")}
            />
          </label>
        </div>
      </Card>

      <Card data-tour="profile-language" className="p-4">
        <CaptionLabel>{t("language")}</CaptionLabel>
        <p className="mt-0.5 text-xs text-ink-2">{t("languageHint")}</p>
        <div className="mt-3">
          <LanguageToggle current={initial.language} />
        </div>
      </Card>

      <Card data-tour="profile-pin" className="space-y-3 p-4">
        <div>
          <CaptionLabel>{t("changePin")}</CaptionLabel>
          <p className="mt-0.5 text-xs text-ink-2">{t("changePinHint")}</p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="block">
            <CaptionLabel>{t("currentPin")}</CaptionLabel>
            <input
              type="password"
              value={currentPin}
              onChange={(e) => setCurrentPin(e.target.value)}
              inputMode="numeric"
              autoComplete="current-password"
              className={cn(FIELD, "num")}
            />
          </label>
          <label className="block">
            <CaptionLabel>{t("newPin")}</CaptionLabel>
            <input
              type="password"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value)}
              inputMode="numeric"
              autoComplete="new-password"
              className={cn(FIELD, "num")}
            />
          </label>
          <label className="block">
            <CaptionLabel>{t("confirmPin")}</CaptionLabel>
            <input
              type="password"
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value)}
              inputMode="numeric"
              autoComplete="new-password"
              className={cn(FIELD, "num")}
            />
          </label>
        </div>
      </Card>

      <button
        type="submit"
        disabled={isPending}
        className="h-12 w-full rounded-full bg-fab px-4 text-sm font-bold text-white shadow-fab active:translate-y-[2px] disabled:opacity-60"
      >
        {isPending ? `${t("save")}…` : t("save")}
      </button>
    </form>
  );
}
