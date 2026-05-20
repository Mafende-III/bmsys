"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { updateMyProfile } from "@/lib/users/actions";
import type { Locale } from "@/i18n/config";
import { LanguageToggle } from "@/app/_components/LanguageToggle";

type Initial = {
  name: string;
  phone: string;
  role: "OWNER" | "SELLER";
  language: Locale;
};

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
    <form action={handleSubmit} className="space-y-5">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {savedAt && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {tc("saved")}
        </div>
      )}

      <section
        data-tour="profile-identity"
        className="rounded-2xl border border-zinc-200 bg-white p-4 space-y-3"
      >
        <label className="block">
          <span className="text-sm font-medium">{t("name")}</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={100}
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
        </label>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium">{t("phone")}</span>
            <input
              type="tel"
              value={initial.phone}
              disabled
              className="mt-1 block w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-500"
            />
            <span className="mt-1 block text-xs text-zinc-500">
              {t("phoneNote")}
            </span>
          </label>
          <label className="block">
            <span className="text-sm font-medium">{t("role")}</span>
            <input
              type="text"
              value={
                initial.role === "OWNER" ? tu("roleOwner") : tu("roleSeller")
              }
              disabled
              className="mt-1 block w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-500"
            />
          </label>
        </div>
      </section>

      <section
        data-tour="profile-language"
        className="rounded-2xl border border-zinc-200 bg-white p-4"
      >
        <h2 className="text-base font-medium">{t("language")}</h2>
        <p className="mt-0.5 text-xs text-zinc-600">{t("languageHint")}</p>
        <div className="mt-3">
          <LanguageToggle current={initial.language} />
        </div>
      </section>

      <section
        data-tour="profile-pin"
        className="rounded-2xl border border-zinc-200 bg-white p-4 space-y-3"
      >
        <div>
          <h2 className="text-base font-medium">{t("changePin")}</h2>
          <p className="mt-0.5 text-xs text-zinc-600">{t("changePinHint")}</p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="text-sm font-medium">{t("currentPin")}</span>
            <input
              type="password"
              value={currentPin}
              onChange={(e) => setCurrentPin(e.target.value)}
              inputMode="numeric"
              autoComplete="current-password"
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">{t("newPin")}</span>
            <input
              type="password"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value)}
              inputMode="numeric"
              autoComplete="new-password"
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">{t("confirmPin")}</span>
            <input
              type="password"
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value)}
              inputMode="numeric"
              autoComplete="new-password"
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
          </label>
        </div>
      </section>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
        >
          {isPending ? `${t("save")}…` : t("save")}
        </button>
      </div>
    </form>
  );
}
