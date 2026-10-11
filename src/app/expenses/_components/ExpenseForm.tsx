"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Banknote, Landmark, Smartphone } from "lucide-react";
import { useTranslations } from "next-intl";
import { CaptionLabel, MoneyField } from "@/components/ui";
import { cn } from "@/lib/cn";
import { createExpense } from "@/lib/expenses/actions";
import {
  PAYMENT_METHODS,
  type ExpensePaymentMethod,
} from "@/lib/expenses/schema";

type CategoryOption = { id: string; name: string };
type SupplierOption = { id: string; name: string };

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const FIELD =
  "mt-1.5 block h-11 w-full rounded-panel border border-rule bg-surface px-3 text-sm text-ink focus:border-rule-active focus:outline-none focus:ring-1 focus:ring-rule-active";

export function ExpenseForm({
  categories,
  suppliers,
}: {
  categories: CategoryOption[];
  suppliers: SupplierOption[];
}) {
  const router = useRouter();
  const t = useTranslations("expenses.form");
  const tc = useTranslations("common");
  const tt = useTranslations("treasury");

  const [date, setDate] = useState(todayISO());
  const [amount, setAmount] = useState(0);
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [description, setDescription] = useState("");
  const [paymentMethod, setPaymentMethod] =
    useState<ExpensePaymentMethod>("CASH");
  const [paymentReference, setPaymentReference] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [idempotencyKey, setIdempotencyKey] = useState(() =>
    crypto.randomUUID(),
  );

  const methodMeta: Record<
    ExpensePaymentMethod,
    { label: string; icon: React.ReactNode }
  > = {
    CASH: {
      label: tt("cash"),
      icon: <Banknote className="h-4 w-4" strokeWidth={2.2} />,
    },
    MOMO: {
      label: tt("momo"),
      icon: <Smartphone className="h-4 w-4" strokeWidth={2.2} />,
    },
    BANK: {
      label: tt("bank"),
      icon: <Landmark className="h-4 w-4" strokeWidth={2.2} />,
    },
  };

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const r = await createExpense(idempotencyKey, {
        date,
        amount,
        categoryId,
        description,
        paymentMethod,
        paymentReference: paymentReference || undefined,
        supplierId: supplierId || undefined,
      });
      if (!r.ok) {
        setError(r.error);
        setIdempotencyKey(crypto.randomUUID());
        return;
      }
      router.push("/expenses");
    });
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-panel bg-error-wash px-3.5 py-2.5 text-sm font-semibold text-error">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <CaptionLabel>{t("date")}</CaptionLabel>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            className={FIELD}
          />
        </label>
        <MoneyField
          label={t("amount")}
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value || 0))}
          required
          inputClassName="mt-1.5"
        />
      </div>

      <label className="block">
        <CaptionLabel>{t("category")}</CaptionLabel>
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

      <label className="block">
        <CaptionLabel>{t("note")}</CaptionLabel>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          placeholder={t("notePlaceholder")}
          className={FIELD}
        />
      </label>

      <fieldset>
        <legend>
          <CaptionLabel>{t("method")}</CaptionLabel>
        </legend>
        <div className="mt-1.5 grid grid-cols-3 gap-2">
          {PAYMENT_METHODS.map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={paymentMethod === m}
              onClick={() => setPaymentMethod(m)}
              className={cn(
                "flex h-12 items-center justify-center gap-2 rounded-panel text-sm",
                paymentMethod === m
                  ? "bg-ink font-bold text-white"
                  : "bg-surface font-semibold text-ink-2 ring-1 ring-inset ring-rule",
              )}
            >
              {methodMeta[m].icon}
              {methodMeta[m].label}
            </button>
          ))}
        </div>
      </fieldset>

      {paymentMethod !== "CASH" && (
        <label className="block">
          <CaptionLabel>{t("reference")}</CaptionLabel>
          <input
            type="text"
            value={paymentReference}
            onChange={(e) => setPaymentReference(e.target.value)}
            placeholder={t("referencePlaceholder")}
            className={FIELD}
          />
        </label>
      )}

      <label className="block">
        <CaptionLabel>{t("supplier")}</CaptionLabel>
        <select
          value={supplierId}
          onChange={(e) => setSupplierId(e.target.value)}
          className={FIELD}
        >
          <option value="">{t("noSupplier")}</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>

      <div className="flex gap-2.5 pt-1">
        <Link
          href="/expenses"
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
          {isPending ? t("creating") : t("create")}
        </button>
      </div>
    </div>
  );
}
