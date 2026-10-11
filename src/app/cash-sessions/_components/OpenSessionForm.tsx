"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Card, CaptionLabel, MoneyField } from "@/components/ui";
import { openCashSession } from "@/lib/cash-sessions/actions";

const FIELD =
  "mt-1.5 block h-11 w-full rounded-panel border border-rule bg-surface px-3 text-sm text-ink focus:border-rule-active focus:outline-none focus:ring-1 focus:ring-rule-active";

export function OpenSessionForm() {
  const router = useRouter();
  const t = useTranslations("cash");
  const [openingFloat, setOpeningFloat] = useState(0);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [idempotencyKey, setIdempotencyKey] = useState(() =>
    crypto.randomUUID(),
  );

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const r = await openCashSession(idempotencyKey, {
        openingFloat,
        note,
      });
      if (!r.ok) {
        setError(r.error);
        setIdempotencyKey(crypto.randomUUID());
        return;
      }
      router.push(`/cash-sessions/${r.data.id}`);
    });
  }

  return (
    <Card className="p-4">
      <p className="text-[15px] font-bold text-ink">{t("openTillBtn")}</p>
      <p className="mt-0.5 text-[13px] text-ink-2">{t("openHint")}</p>

      {error && (
        <div className="mt-3 rounded-panel bg-error-wash px-3.5 py-2.5 text-sm font-semibold text-error">
          {error}
        </div>
      )}

      <div className="mt-3.5 space-y-3">
        <MoneyField
          label={t("form.openingFloat")}
          value={openingFloat}
          onChange={(e) => setOpeningFloat(Number(e.target.value || 0))}
          inputClassName="mt-1.5"
        />

        <label className="block">
          <CaptionLabel>{t("form.noteOptional")}</CaptionLabel>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t("openNotePlaceholder")}
            className={FIELD}
          />
        </label>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={isPending}
          className="h-12 w-full rounded-full bg-fab px-4 text-sm font-bold text-white shadow-fab active:translate-y-[2px] disabled:opacity-60"
        >
          {isPending ? t("form.opening") : t("openTillBtn")}
        </button>
      </div>
    </Card>
  );
}
