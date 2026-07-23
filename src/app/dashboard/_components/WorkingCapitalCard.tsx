"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRightLeft, Banknote, Landmark, Smartphone } from "lucide-react";
import { useTranslations } from "next-intl";
import { formatRWF } from "@/lib/format";
import { recordCashTransfer } from "@/lib/treasury/actions";
import type { WorkingCapital } from "@/lib/treasury/queries";

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
    <section
      data-tour="dash-capital"
      className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-zinc-800">
            {t("title")}
          </h3>
          <p className="text-xs text-zinc-500">{t("subtitle")}</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
        >
          <ArrowRightLeft className="h-3.5 w-3.5" strokeWidth={2} />
          {t("moveCash")}
        </button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
          <p className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-zinc-500">
            <Banknote className="h-3 w-3" strokeWidth={2} />
            {t("cash")}
          </p>
          <p className="mt-0.5 font-mono text-base font-semibold tabular-nums">
            {formatRWF(capital.cashOnHand)}
          </p>
          <p className="text-[10px] text-zinc-500">
            {capital.tillOpen ? t("tillOpen") : t("tillClosed")}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
          <p className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-zinc-500">
            <Smartphone className="h-3 w-3" strokeWidth={2} />
            {t("momo")}
          </p>
          {capital.momo.initialised ? (
            <p className="mt-0.5 font-mono text-base font-semibold tabular-nums">
              {formatRWF(capital.momo.balance)}
            </p>
          ) : (
            <Link
              href="/settings"
              className="mt-0.5 block text-xs text-blue-700 underline hover:no-underline"
            >
              {t("setBalance")}
            </Link>
          )}
        </div>
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
          <p className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-zinc-500">
            <Landmark className="h-3 w-3" strokeWidth={2} />
            {t("bank")}
          </p>
          {capital.bank.initialised ? (
            <p className="mt-0.5 font-mono text-base font-semibold tabular-nums">
              {formatRWF(capital.bank.balance)}
            </p>
          ) : (
            <Link
              href="/settings"
              className="mt-0.5 block text-xs text-blue-700 underline hover:no-underline"
            >
              {t("setBalance")}
            </Link>
          )}
        </div>
        <div className="rounded-xl border-2 border-zinc-900 bg-zinc-900 p-3 text-white">
          <p className="text-[10px] uppercase tracking-wide text-zinc-400">
            {t("total")}
          </p>
          <p className="mt-0.5 font-mono text-base font-semibold tabular-nums">
            {formatRWF(capital.totalAvailable)}
          </p>
          <p className="text-[10px] text-zinc-400">{t("totalHint")}</p>
        </div>
      </div>

      {open && (
        <div className="mt-3 space-y-2 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </p>
          )}
          <div className="flex flex-wrap items-end gap-2">
            <label className="block text-xs">
              <span className="text-zinc-600">{t("transferAmount")}</span>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                step={100}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g. 50000"
                className="mt-0.5 block w-32 rounded-lg border border-zinc-300 px-2 py-1.5 font-mono text-sm tabular-nums"
              />
            </label>
            <div className="flex overflow-hidden rounded-lg border border-zinc-300">
              {(["MOMO", "BANK"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setToMethod(m)}
                  className={`px-3 py-1.5 text-xs font-medium ${
                    toMethod === m
                      ? "bg-zinc-900 text-white"
                      : "bg-white text-zinc-700"
                  }`}
                >
                  {m === "MOMO" ? t("momo") : t("bank")}
                </button>
              ))}
            </div>
            <label className="block flex-1 text-xs">
              <span className="text-zinc-600">{t("transferReference")}</span>
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder={t("transferReferencePlaceholder")}
                className="mt-0.5 block w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm"
              />
            </label>
            <button
              type="button"
              onClick={submit}
              disabled={isPending || !amount}
              className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
            >
              {isPending ? t("transferSaving") : t("transferSave")}
            </button>
          </div>
          <p className="text-[10px] text-zinc-500">{t("transferHint")}</p>
        </div>
      )}
    </section>
  );
}
