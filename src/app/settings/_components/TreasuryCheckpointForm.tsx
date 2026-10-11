"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Wallet } from "lucide-react";
import { useTranslations } from "next-intl";
import { Card, CaptionLabel, MoneyField } from "@/components/ui";
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
    <Card className="p-4">
      <div className="flex items-center gap-2">
        <Wallet className="h-4 w-4 text-ink-2" strokeWidth={2.2} />
        <CaptionLabel>{t("checkpointTitle")}</CaptionLabel>
      </div>
      <p className="mt-1 text-xs text-ink-2">{t("checkpointHint")}</p>

      {error && (
        <p className="mt-3 rounded-panel bg-error-wash px-3.5 py-2.5 text-sm font-semibold text-error">
          {error}
        </p>
      )}
      {saved && (
        <p className="mt-3 flex items-center gap-2 rounded-panel bg-success-wash px-3.5 py-2.5 text-sm font-semibold text-success">
          <CheckCircle2 className="h-4 w-4 shrink-0" strokeWidth={2.2} />
          {t("checkpointSaved")}
        </p>
      )}

      <div className="mt-3.5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <MoneyField
          label={t("momoBalanceLabel")}
          min={0}
          step={100}
          value={momoRaw}
          onChange={(e) => setMomoRaw(e.target.value)}
          placeholder={
            momo.initialised
              ? t("currentDerived", { amount: formatRWF(momo.balance) })
              : t("notSet")
          }
          inputClassName="mt-1.5"
        />
        <MoneyField
          label={t("bankBalanceLabel")}
          min={0}
          step={100}
          value={bankRaw}
          onChange={(e) => setBankRaw(e.target.value)}
          placeholder={
            bank.initialised
              ? t("currentDerived", { amount: formatRWF(bank.balance) })
              : t("notSet")
          }
          inputClassName="mt-1.5"
        />
      </div>

      <button
        type="button"
        onClick={submit}
        disabled={
          isPending || (momoRaw.trim() === "" && bankRaw.trim() === "")
        }
        className="mt-3.5 h-12 w-full rounded-full bg-fab px-4 text-sm font-bold text-white shadow-fab active:translate-y-[2px] disabled:opacity-50"
      >
        {isPending ? t("checkpointSaving") : t("checkpointSave")}
      </button>
    </Card>
  );
}
