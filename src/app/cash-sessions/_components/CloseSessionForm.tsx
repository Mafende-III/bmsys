"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Card, CaptionLabel, MoneyField } from "@/components/ui";
import { cn } from "@/lib/cn";
import { closeCashSession } from "@/lib/cash-sessions/actions";
import { describeVariance } from "@/lib/copy";
import { formatRWF } from "@/lib/format";

const FIELD =
  "mt-1.5 block h-11 w-full rounded-panel border border-rule bg-surface px-3 text-sm text-ink focus:border-rule-active focus:outline-none focus:ring-1 focus:ring-rule-active";

export function CloseSessionForm({
  sessionId,
  openingFloat,
  cashSalesTotal,
}: {
  sessionId: string;
  openingFloat: number;
  cashSalesTotal: number;
}) {
  const router = useRouter();
  const t = useTranslations("cash");
  const [closingCount, setClosingCount] = useState(
    openingFloat + cashSalesTotal,
  );
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [idempotencyKey, setIdempotencyKey] = useState(() =>
    crypto.randomUUID(),
  );

  const expected = openingFloat + cashSalesTotal;
  const variance = useMemo(
    () => closingCount - expected,
    [closingCount, expected],
  );

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const r = await closeCashSession(idempotencyKey, sessionId, {
        closingCount,
        note,
      });
      if (!r.ok) {
        setError(r.error);
        setIdempotencyKey(crypto.randomUUID());
        return;
      }
      router.refresh();
    });
  }

  return (
    <Card className="p-4">
      <p className="text-[15px] font-bold text-ink">{t("closeTillBtn")}</p>

      {error && (
        <div className="mt-3 rounded-panel bg-error-wash px-3.5 py-2.5 text-sm font-semibold text-error">
          {error}
        </div>
      )}

      <dl className="mt-3 space-y-2">
        <div className="flex items-baseline justify-between gap-3">
          <dt>
            <CaptionLabel>{t("openingFloat")}</CaptionLabel>
          </dt>
          <dd className="num text-[15px] font-semibold text-ink">
            {formatRWF(openingFloat)}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt>
            <CaptionLabel>{t("cashSalesPlain")}</CaptionLabel>
          </dt>
          <dd className="num text-[15px] font-semibold text-ink">
            {formatRWF(cashSalesTotal)}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3 border-t border-rule-hair pt-2">
          <dt>
            <CaptionLabel>{t("form.expected")}</CaptionLabel>
          </dt>
          <dd className="num text-base font-bold text-ink">
            {formatRWF(expected)}
          </dd>
        </div>
      </dl>

      <div className="mt-3.5 space-y-3">
        <MoneyField
          label={t("form.closingCount")}
          value={closingCount}
          onChange={(e) => setClosingCount(Number(e.target.value || 0))}
          inputClassName="mt-1.5"
        />

        <VarianceCallout variance={variance} />

        <label className="block">
          <CaptionLabel>{t("form.noteOptional")}</CaptionLabel>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t("form.notePlaceholder")}
            className={FIELD}
          />
        </label>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={isPending}
          className="h-12 w-full rounded-full bg-fab px-4 text-sm font-bold text-white shadow-fab active:translate-y-[2px] disabled:opacity-60"
        >
          {isPending ? t("form.closing") : t("closeTillBtn")}
        </button>
      </div>
    </Card>
  );
}

function VarianceCallout({ variance }: { variance: number }) {
  const { tone, label, sentence } = describeVariance(variance);
  return (
    <div
      className={cn(
        "rounded-panel px-3.5 py-2.5 text-sm",
        tone === "balanced"
          ? "bg-success-wash text-success"
          : tone === "over"
            ? "bg-warning-wash text-warning"
            : "bg-error-wash text-error",
      )}
    >
      <span className="font-bold">{label}</span>{" "}
      <span className="font-semibold">{sentence}</span>
    </div>
  );
}
