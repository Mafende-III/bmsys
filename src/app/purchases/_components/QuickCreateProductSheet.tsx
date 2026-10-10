"use client";

import { useState, useTransition } from "react";
import { Check, ChevronLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  BottomSheet,
  CaptionLabel,
  MoneyField,
  Stepper,
} from "@/components/ui";
import { cn } from "@/lib/cn";
import { createProduct } from "@/lib/products/actions";

export type CreatedProduct = {
  id: string;
  sku: string;
  name: string;
  unitsPerCarton: number;
  costPerCarton: number;
};

/** "AMATA 500ML" → "AMATA-500ML": matches the product SKU pattern. */
function deriveSku(name: string): string {
  return name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9.]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 50);
}

function parseAmount(v: string): number {
  const n = Number(v.trim());
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

function ProfitChip({ amount, suffix }: { amount: number; suffix: string }) {
  const tone =
    amount > 0
      ? "bg-success-wash text-success"
      : amount < 0
        ? "bg-error-wash text-error"
        : "bg-ground text-ink-2";
  return (
    <span
      className={cn(
        "num inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold",
        tone,
      )}
    >
      {amount > 0 ? `+${amount.toLocaleString("en-US")}` : amount.toLocaleString("en-US")}{" "}
      {suffix}
    </span>
  );
}

/**
 * The stepped product quick-create that lives INSIDE receive stock:
 * name → carton size + buy cost → sell prices, then straight back
 * into the purchase line. Uses the same createProduct action (and
 * idempotency + audit) as the full product form.
 */
export function QuickCreateProductSheet({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (product: CreatedProduct) => void;
}) {
  const t = useTranslations("purchases.form");
  const tc = useTranslations("common");
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [name, setName] = useState("");
  const [units, setUnits] = useState(12);
  const [cost, setCost] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [cartonPrice, setCartonPrice] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [key, setKey] = useState(() => crypto.randomUUID());

  const sku = deriveSku(name);
  const costN = parseAmount(cost);
  const singleProfit =
    parseAmount(unitPrice) - (units > 0 ? Math.round(costN / units) : 0);
  const cartonProfit = parseAmount(cartonPrice) - costN;

  function reset() {
    setStep(1);
    setName("");
    setUnits(12);
    setCost("");
    setUnitPrice("");
    setCartonPrice("");
    setError(null);
    setKey(crypto.randomUUID());
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await createProduct(key, {
        sku,
        name: name.trim(),
        categoryId: null,
        iconKey: null,
        iconEmoji: null,
        unitsPerCarton: units,
        costPerCarton: costN,
        unitPrice: parseAmount(unitPrice),
        cartonPrice: parseAmount(cartonPrice),
        sellableAsUnit: true,
        sellableAsCarton: true,
        lowStockThresholdUnits: 0,
        minMarginBps: 0,
        loyaltyPointsPerUnit: 0,
      });
      if (!result.ok) {
        setError(result.error);
        setKey(crypto.randomUUID());
        return;
      }
      onCreated({
        id: result.data.id,
        sku,
        name: name.trim(),
        unitsPerCarton: units,
        costPerCarton: costN,
      });
      reset();
    });
  }

  const backButton = (target: 1 | 2) => (
    <button
      type="button"
      onClick={() => setStep(target)}
      aria-label="Back"
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-keycap shadow-keycap active:bg-none active:bg-well active:shadow-well"
    >
      <ChevronLeft className="h-5 w-5 text-ink" strokeWidth={2.2} />
    </button>
  );

  return (
    <BottomSheet
      open={open}
      onClose={() => {
        onClose();
        reset();
      }}
      title={t("newProduct")}
      headerExtra={
        <span className="flex gap-1.5">
          {([1, 2, 3] as const).map((s) => (
            <span
              key={s}
              className={cn(
                "h-2 w-2 rounded-full",
                step >= s ? "bg-primary" : "bg-rule-hair",
              )}
            />
          ))}
        </span>
      }
    >
      {error && (
        <p className="mb-3 rounded-panel bg-error-wash px-3 py-2 text-xs font-semibold text-error">
          {error}
        </p>
      )}

      {step === 1 && (
        <div className="space-y-3">
          <label className="block">
            <CaptionLabel className="mb-1.5">{t("qcName")}</CaptionLabel>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("qcNamePlaceholder")}
              autoFocus
              className="block h-12 w-full rounded-sheet border border-rule bg-surface px-3.5 text-base font-semibold text-ink focus:border-rule-active focus:outline-none focus:ring-1 focus:ring-rule-active"
            />
          </label>
          {sku ? (
            <p className="flex items-center gap-2 text-xs text-ink-2">
              <Check className="h-3.5 w-3.5 text-success" strokeWidth={3} />
              {t("qcCodeAuto", { sku })}
            </p>
          ) : null}
          <button
            type="button"
            disabled={!sku}
            onClick={() => setStep(2)}
            className="h-12 w-full rounded-full bg-fab text-base font-bold text-white shadow-fab active:translate-y-[2px] disabled:opacity-50"
          >
            {tc("next")}
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <CaptionLabel>{t("qcPerCarton")}</CaptionLabel>
            <Stepper value={units} onChange={setUnits} min={1} />
          </div>
          <MoneyField
            label={t("qcBuyAt")}
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            placeholder="2800"
          />
          <div className="flex gap-2.5">
            {backButton(1)}
            <button
              type="button"
              onClick={() => setStep(3)}
              className="h-12 flex-1 rounded-full bg-fab text-base font-bold text-white shadow-fab active:translate-y-[2px]"
            >
              {tc("next")}
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <MoneyField
              label={t("qcSellSingle")}
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
              placeholder="400"
            />
            <MoneyField
              label={t("qcSellCarton")}
              value={cartonPrice}
              onChange={(e) => setCartonPrice(e.target.value)}
              placeholder="4500"
            />
          </div>
          <div className="flex gap-2">
            <ProfitChip amount={singleProfit} suffix={t("qcPerSingle")} />
            <ProfitChip amount={cartonProfit} suffix={t("qcPerWholeCarton")} />
          </div>
          <div className="flex gap-2.5 pt-1">
            {backButton(2)}
            <button
              type="button"
              onClick={submit}
              disabled={isPending}
              className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-fab text-base font-bold text-white shadow-fab active:translate-y-[2px] disabled:opacity-60"
            >
              <Check className="h-5 w-5" strokeWidth={2.4} />
              {isPending ? t("working") : t("qcAddToOrder")}
            </button>
          </div>
        </div>
      )}
    </BottomSheet>
  );
}

