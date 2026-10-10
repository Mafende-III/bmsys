"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRightLeft, Banknote, Landmark, Smartphone } from "lucide-react";
import { useTranslations } from "next-intl";
import { Card, CaptionLabel, MoneyField } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatRWF } from "@/lib/format";
import { recordCashTransfer } from "@/lib/treasury/actions";
import type { WorkingCapital } from "@/lib/treasury/queries";

function MoneyRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between border-b border-rule-hair py-2.5">
      <span className="flex items-center gap-2.5 text-sm font-semibold text-ink">
        <span className="text-primary">{icon}</span>
        {label}
      </span>
      {children}
    </div>
  );
}

export function WorkingCapitalCard({ capital }: { capital: WorkingCapital }) {
  const t = useTranslations("treasury");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [toMethod, setToMethod] = useState<"MOMO" | "BANK">("MOMO");
  const [reference, setReference] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const r = await recordCashTransfer({
        amount: Number(amount),
        toMethod,
        reference,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setOpen(false);
      setAmount("");
      setReference("");
      router.refresh();
    });
  }

  return (
    <Card data-tour="dash-capital" className="p-4">
      <div className="flex items-center justify-between gap-2">
        <CaptionLabel>{t("title")}</CaptionLabel>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-surface px-3.5 py-2 text-xs font-bold text-primary ring-1 ring-inset ring-rule"
        >
          <ArrowRightLeft className="h-3.5 w-3.5" strokeWidth={2.2} />
          {t("moveCash")}
        </button>
      </div>

      <div className="mt-1">
        <MoneyRow
          icon={<Banknote className="h-[18px] w-[18px]" strokeWidth={2} />}
          label={t("cash")}
        >
          <span className="num text-[15px] font-semibold text-ink">
            {formatRWF(capital.cashOnHand)}
          </span>
        </MoneyRow>
        <MoneyRow
          icon={<Smartphone className="h-[18px] w-[18px]" strokeWidth={2} />}
          label={t("momo")}
        >
          {capital.momo.initialised ? (
            <span className="num text-[15px] font-semibold text-ink">
              {formatRWF(capital.momo.balance)}
            </span>
          ) : (
            <Link
              href="/settings"
              className="text-[13px] font-bold text-primary"
            >
              {t("setBalance")}
            </Link>
          )}
        </MoneyRow>
        <MoneyRow
          icon={<Landmark className="h-[18px] w-[18px]" strokeWidth={2} />}
          label={t("bank")}
        >
          {capital.bank.initialised ? (
            <span className="num text-[15px] font-semibold text-ink">
              {formatRWF(capital.bank.balance)}
            </span>
          ) : (
            <Link
              href="/settings"
              className="text-[13px] font-bold text-primary"
            >
              {t("setBalance")}
            </Link>
          )}
        </MoneyRow>
        <div className="flex items-baseline justify-between pt-3">
          <CaptionLabel>{t("total")}</CaptionLabel>
          <span className="num text-xl font-bold text-ink">
            {formatRWF(capital.totalAvailable)}
          </span>
        </div>
      </div>

      {open && (
        <div className="mt-3 space-y-3 rounded-sheet bg-ground p-3">
          {error && (
            <p className="rounded-panel bg-error-wash px-3 py-2 text-xs font-semibold text-error">
              {error}
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <MoneyField
              label={t("transferAmount")}
              min={1}
              step={100}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="50000"
            />
            <div>
              <CaptionLabel className="mb-1.5">{t("momo")} / {t("bank")}</CaptionLabel>
              <div className="flex gap-2">
                {(["MOMO", "BANK"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setToMethod(m)}
                    className={cn(
                      "h-11 flex-1 rounded-panel text-[13px] font-bold",
                      toMethod === m
                        ? "bg-ink text-white"
                        : "bg-surface text-ink-2 ring-1 ring-inset ring-rule",
                    )}
                  >
                    {m === "MOMO" ? t("momo") : t("bank")}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <label className="block">
            <CaptionLabel className="mb-1.5">
              {t("transferReference")}
            </CaptionLabel>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder={t("transferReferencePlaceholder")}
              className="block h-11 w-full rounded-panel border border-rule bg-surface px-3 text-sm text-ink focus:border-rule-active focus:outline-none focus:ring-1 focus:ring-rule-active"
            />
          </label>
          <button
            type="button"
            onClick={submit}
            disabled={isPending || !amount}
            className="h-11 w-full rounded-full bg-fab text-sm font-bold text-white shadow-fab active:translate-y-[2px] disabled:opacity-50"
          >
            {isPending ? t("transferSaving") : t("transferSave")}
          </button>
          <p className="text-[11px] text-ink-2">{t("transferHint")}</p>
        </div>
      )}
    </Card>
  );
}
