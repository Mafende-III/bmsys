"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { CaptionLabel, MoneyField } from "@/components/ui";
import { cn } from "@/lib/cn";
import { upsertRecurring } from "@/lib/expenses/actions";
import {
  RECURRING_FREQUENCIES,
  type RecurringFrequency,
} from "@/lib/expenses/schema";

type CategoryOption = { id: string; name: string };

type Mode =
  | { kind: "create" }
  | {
      kind: "edit";
      id: string;
      initial: {
        categoryId: string;
        amount: number;
        description: string;
        frequency: RecurringFrequency;
        dayOfPeriod: number;
        active: boolean;
      };
    };

const FIELD =
  "mt-1.5 block h-11 w-full rounded-panel border border-rule bg-surface px-3 text-sm text-ink focus:border-rule-active focus:outline-none focus:ring-1 focus:ring-rule-active";

export function RecurringForm({
  mode,
  categories,
}: {
  mode: Mode;
  categories: CategoryOption[];
}) {
  const router = useRouter();
  const t = useTranslations("expenses.recurring");
  const tf = useTranslations("expenses.recurring.form");
  const te = useTranslations("expenses.form");
  const tc = useTranslations("common");
  const locale = useLocale();

  // 2021-08-01 was a Sunday — index 0..6 maps to localized weekday names.
  const weekdayName = (i: number) =>
    new Intl.DateTimeFormat(locale, { weekday: "long" }).format(
      new Date(2021, 7, 1 + i),
    );

  const initial =
    mode.kind === "edit"
      ? mode.initial
      : {
          categoryId: categories[0]?.id ?? "",
          amount: 0,
          description: "",
          frequency: "MONTHLY" as RecurringFrequency,
          dayOfPeriod: 1,
          active: true,
        };

  const [categoryId, setCategoryId] = useState(initial.categoryId);
  const [amount, setAmount] = useState(initial.amount);
  const [description, setDescription] = useState(initial.description);
  const [frequency, setFrequency] = useState<RecurringFrequency>(
    initial.frequency,
  );
  const [dayOfPeriod, setDayOfPeriod] = useState(initial.dayOfPeriod);
  const [active, setActive] = useState(initial.active);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [idempotencyKey, setIdempotencyKey] = useState(() =>
    crypto.randomUUID(),
  );

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const r = await upsertRecurring(
        idempotencyKey,
        mode.kind === "edit" ? mode.id : null,
        {
          categoryId,
          amount,
          description,
          frequency,
          dayOfPeriod,
          active,
        },
      );
      if (!r.ok) {
        setError(r.error);
        setIdempotencyKey(crypto.randomUUID());
        return;
      }
      router.push("/expenses/recurring");
    });
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-panel bg-error-wash px-3.5 py-2.5 text-sm font-semibold text-error">
          {error}
        </div>
      )}

      <label className="block">
        <CaptionLabel>{tf("description")}</CaptionLabel>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={tf("descriptionPlaceholder")}
          className={FIELD}
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <MoneyField
          label={te("amount")}
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value || 0))}
          inputClassName="mt-1.5"
        />
        <label className="block">
          <CaptionLabel>{te("category")}</CaptionLabel>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className={FIELD}
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <CaptionLabel>{tf("frequency")}</CaptionLabel>
          <select
            value={frequency}
            onChange={(e) => {
              const f = e.target.value as RecurringFrequency;
              setFrequency(f);
              setDayOfPeriod(f === "MONTHLY" ? 1 : 0);
            }}
            className={FIELD}
          >
            {RECURRING_FREQUENCIES.map((f) => (
              <option key={f} value={f}>
                {f === "MONTHLY" ? t("monthly") : t("weekly")}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <CaptionLabel>
            {frequency === "MONTHLY" ? tf("dayOfMonth") : tf("dayOfWeek")}
          </CaptionLabel>
          {frequency === "WEEKLY" ? (
            <select
              value={dayOfPeriod}
              onChange={(e) => setDayOfPeriod(Number(e.target.value))}
              className={FIELD}
            >
              {Array.from({ length: 7 }, (_, i) => (
                <option key={i} value={i}>
                  {weekdayName(i)}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="number"
              min={1}
              max={31}
              step={1}
              inputMode="numeric"
              value={dayOfPeriod}
              onChange={(e) =>
                setDayOfPeriod(
                  Math.min(31, Math.max(1, Number(e.target.value || 1))),
                )
              }
              className={cn(FIELD, "num text-right text-base font-semibold")}
            />
          )}
        </label>
      </div>

      <label className="flex items-center gap-2.5 rounded-panel bg-ground px-3.5 py-3 text-sm font-semibold text-ink">
        <input
          type="checkbox"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
          className="h-4 w-4 rounded border-rule"
        />
        {tf("activeLabel")}
      </label>

      <div className="flex gap-2.5 pt-1">
        <Link
          href="/expenses/recurring"
          className="flex h-12 flex-1 items-center justify-center rounded-full bg-surface px-5 text-sm font-semibold text-ink-2 ring-1 ring-inset ring-rule"
        >
          {tc("cancel")}
        </Link>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isPending || amount <= 0 || description.trim() === ""}
          className="h-12 flex-1 rounded-full bg-fab px-4 text-sm font-bold text-white shadow-fab active:translate-y-[2px] disabled:opacity-60"
        >
          {isPending
            ? tf("saving")
            : mode.kind === "create"
              ? tf("create")
              : tc("save")}
        </button>
      </div>
    </div>
  );
}
