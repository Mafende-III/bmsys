"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { CaptionLabel, Card } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatRWF } from "@/lib/format";
import { createCoupon } from "@/lib/coupons/actions";

type ProductOption = {
  id: string;
  name: string;
  sku: string;
  costPerCarton: number;
  unitsPerCarton: number;
  unitPrice: number;
  cartonPrice: number;
  minMarginBps: number;
};

const FIELD =
  "mt-1.5 block h-11 w-full rounded-panel border border-rule bg-surface px-3 text-sm text-ink focus:border-rule-active focus:outline-none focus:ring-1 focus:ring-rule-active";

export function CouponForm({ products }: { products: ProductOption[] }) {
  const router = useRouter();
  const t = useTranslations("coupons.form");
  const [type, setType] = useState<"FIXED" | "PERCENT">("PERCENT");
  const [value, setValue] = useState("10");
  const [productId, setProductId] = useState("");
  const [expiresInDays, setExpiresInDays] = useState("7");
  const [allowFloorOverride, setAllowFloorOverride] = useState(false);
  const [perUnit, setPerUnit] = useState(false);
  const [notes, setNotes] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ code: string; expiresAt: Date } | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedProduct = products.find((p) => p.id === productId) ?? null;
  const numericValue = Number(value);
  // Per-unit math is well-defined for PERCENT (always) and FIXED+perUnit.
  // For FIXED+per-cart, the discount spreads across qty which we don't
  // know until checkout — so the preview is hidden in that case.
  const floorPreview = (() => {
    if (!selectedProduct) return null;
    if (!Number.isFinite(numericValue) || numericValue <= 0) return null;
    if (type === "FIXED" && !perUnit) return null;
    const unitCost = Math.ceil(
      selectedProduct.costPerCarton / Math.max(1, selectedProduct.unitsPerCarton),
    );
    const unitDiscount =
      type === "PERCENT"
        ? Math.floor((selectedProduct.unitPrice * numericValue) / 100)
        : numericValue;
    const finalUnitPrice = selectedProduct.unitPrice - unitDiscount;
    return {
      unitCost,
      unitDiscount,
      finalUnitPrice,
      belowCost: finalUnitPrice < unitCost,
    };
  })();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await createCoupon({
        code: code || null,
        type,
        value: numericValue,
        productId: productId || null,
        expiresInDays: Number(expiresInDays),
        allowFloorOverride,
        perUnit: type === "FIXED" ? perUnit : false,
        notes: notes || null,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSuccess({
        code: result.data.code,
        expiresAt: result.data.expiresAt,
      });
      // Reset most fields for quick "another one" flow
      setValue(type === "PERCENT" ? "10" : "500");
      setNotes("");
      setCode("");
    });
  }

  if (success) {
    return (
      <div className="space-y-3">
        <div className="rounded-panel bg-success-wash p-4">
          <div className="flex items-start gap-2">
            <CheckCircle2
              className="mt-0.5 h-5 w-5 shrink-0 text-success"
              strokeWidth={2.2}
            />
            <div className="flex-1">
              <p className="text-sm font-bold text-success">
                {t("createdTitle")}
              </p>
              <p className="num mt-2 select-all rounded-panel bg-surface px-3 py-2 text-center text-2xl font-bold tracking-widest text-ink ring-1 ring-inset ring-rule-hair">
                {success.code}
              </p>
              <p className="mt-2 text-xs font-semibold text-success">
                {t("createdShare", {
                  when: new Date(success.expiresAt).toLocaleString(),
                })}
              </p>
            </div>
          </div>
        </div>
        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={() => setSuccess(null)}
            className="h-12 flex-1 rounded-full bg-surface text-sm font-bold text-ink ring-1 ring-inset ring-rule"
          >
            {t("createAnother")}
          </button>
          <button
            type="button"
            onClick={() => router.push("/coupons")}
            className="h-12 flex-1 rounded-full bg-fab text-sm font-bold text-white shadow-fab active:translate-y-[2px]"
          >
            {t("backToList")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && (
        <div className="rounded-panel bg-error-wash px-3.5 py-2.5 text-sm font-semibold text-error">
          {error}
        </div>
      )}

      <div>
        <CaptionLabel>{t("typeLabel")}</CaptionLabel>
        <div className="mt-1.5 grid grid-cols-2 gap-2">
          {(["PERCENT", "FIXED"] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={type === v}
              onClick={() => {
                setType(v);
                setValue(v === "PERCENT" ? "10" : "500");
              }}
              className={cn(
                "flex h-12 items-center justify-center rounded-panel text-sm",
                type === v
                  ? "bg-ink font-bold text-white"
                  : "bg-surface font-semibold text-ink-2 ring-1 ring-inset ring-rule",
              )}
            >
              {v === "PERCENT" ? t("typePercent") : t("typeFixed")}
            </button>
          ))}
        </div>
      </div>

      <label className="block">
        <CaptionLabel>
          {type === "PERCENT" ? t("percentOff") : t("amountOff")}
        </CaptionLabel>
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={type === "PERCENT" ? 100 : undefined}
          step={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          required
          className={cn(FIELD, "num text-right text-base font-semibold")}
        />
      </label>

      {type === "FIXED" && (
        <label className="flex cursor-pointer items-start gap-2.5 rounded-panel bg-ground p-3.5 text-sm">
          <input
            type="checkbox"
            checked={perUnit}
            onChange={(e) => setPerUnit(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-rule"
          />
          <span>
            <span className="font-bold text-ink">{t("perUnitLabel")}</span>
            <span className="mt-0.5 block text-xs text-ink-2">
              {t("perUnitHint")}
            </span>
          </span>
        </label>
      )}

      <label className="block">
        <CaptionLabel>{t("productLabel")}</CaptionLabel>
        <select
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
          className={FIELD}
        >
          <option value="">{t("anyProduct")}</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.sku})
            </option>
          ))}
        </select>
        <span className="mt-1 block text-xs text-ink-2">
          {t("productHint")}
        </span>
      </label>

      {floorPreview && selectedProduct && (
        <div
          className={cn(
            "rounded-panel p-3.5 text-xs",
            floorPreview.belowCost
              ? "bg-error-wash text-error"
              : "bg-ground text-ink-2",
          )}
        >
          <p className="font-bold">
            {t("marginPreview", { name: selectedProduct.name })}
          </p>
          <p className="num mt-1">
            {t("marginLine", {
              cost: formatRWF(floorPreview.unitCost),
              price: formatRWF(selectedProduct.unitPrice),
              final: formatRWF(floorPreview.finalUnitPrice),
            })}
          </p>
          {floorPreview.belowCost && (
            <p className="mt-1.5 flex items-start gap-1.5 font-semibold">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2.2} />
              {t("belowCostWarn")}
            </p>
          )}
        </div>
      )}

      <label className="block">
        <CaptionLabel>{t("expiresIn")}</CaptionLabel>
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={365}
          step={1}
          value={expiresInDays}
          onChange={(e) => setExpiresInDays(e.target.value)}
          required
          className={cn(FIELD, "num text-right text-base font-semibold")}
        />
      </label>

      <label className="block">
        <CaptionLabel>{t("customCode")}</CaptionLabel>
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder={t("codePlaceholder")}
          spellCheck={false}
          autoCapitalize="characters"
          className={cn(FIELD, "num uppercase tracking-wider")}
        />
        <span className="mt-1 block text-xs text-ink-2">{t("codeHint")}</span>
      </label>

      <label className="block">
        <CaptionLabel>{t("noteLabel")}</CaptionLabel>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t("notePlaceholder")}
          className={FIELD}
        />
      </label>

      <label className="flex cursor-pointer items-start gap-2.5 rounded-panel bg-ground p-3.5 text-sm">
        <input
          type="checkbox"
          checked={allowFloorOverride}
          onChange={(e) => setAllowFloorOverride(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-rule"
        />
        <span>
          <span className="font-bold text-ink">{t("floorOverrideLabel")}</span>
          <span className="mt-0.5 block text-xs text-ink-2">
            {t("floorOverrideHint")}
          </span>
        </span>
      </label>

      <button
        type="submit"
        disabled={isPending}
        className="h-12 w-full rounded-full bg-fab px-5 text-sm font-bold text-white shadow-fab active:translate-y-[2px] disabled:opacity-60"
      >
        {isPending ? t("creating") : t("create")}
      </button>
    </form>
  );
}
