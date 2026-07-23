"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Wallet } from "lucide-react";
import { useTranslations } from "next-intl";
import { formatRWF } from "@/lib/format";
import { setTreasuryCheckpoints } from "@/lib/treasury/actions";

type Pot = {
  balance: number;
  initialised: boolean;
  checkpointAt: string | null;
};

export function TreasuryCheckpointForm({
  momo,
  bank,
}: {
  momo: Pot;
  bank: Pot;
}) {
  const t = useTranslations("treasury");
  const router = useRouter();
  const [momoRaw, setMomoRaw] = useState("");
  const [bankRaw, setBankRaw] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function submit() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const r = await setTreasuryCheckpoints({
        momoBalance: momoRaw.trim() === "" ? null : Number(momoRaw),
        bankBalance: bankRaw.trim() === "" ? null : Number(bankRaw),
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setSaved(true);
      setMomoRaw("");
      setBankRaw("");
      router.refresh();
    });
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5">
      <h2 className="flex items-center gap-2 text-base font-semibold">
        <Wallet className="h-4 w-4" strokeWidth={2} />
        {t("checkpointTitle")}
      </h2>
      <p className="mt-1 text-sm text-zinc-600">{t("checkpointHint")}</p>

      {error && (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {saved && (
        <p className="mt-3 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          <CheckCircle2 className="h-4 w-4" strokeWidth={2} />
          {t("checkpointSaved")}
        </p>
      )}

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium text-zinc-800">
            {t("momoBalanceLabel")}
          </span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            step={100}
            value={momoRaw}
            onChange={(e) => setMomoRaw(e.target.value)}
            placeholder={
              momo.initialised
                ? t("currentDerived", { amount: formatRWF(momo.balance) })
                : t("notSet")
            }
            className="mt-1 block w-full rounded-xl border-2 border-zinc-300 px-3 py-2.5 font-mono text-base tabular-nums"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-zinc-800">
            {t("bankBalanceLabel")}
          </span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            step={100}
            value={bankRaw}
            onChange={(e) => setBankRaw(e.target.value)}
            placeholder={
              bank.initialised
                ? t("currentDerived", { amount: formatRWF(bank.balance) })
                : t("notSet")
            }
            className="mt-1 block w-full rounded-xl border-2 border-zinc-300 px-3 py-2.5 font-mono text-base tabular-nums"
          />
        </label>
      </div>

      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={submit}
          disabled={
            isPending || (momoRaw.trim() === "" && bankRaw.trim() === "")
          }
          className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {isPending ? t("checkpointSaving") : t("checkpointSave")}
        </button>
      </div>
    </section>
  );
}
