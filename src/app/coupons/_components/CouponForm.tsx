"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
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

export function CouponForm({ products }: { products: ProductOption[] }) {
  const router = useRouter();
  const [type, setType] = useState<"FIXED" | "PERCENT">("PERCENT");
  const [value, setValue] = useState("10");
  const [productId, setProductId] = useState("");
  const [expiresInDays, setExpiresInDays] = useState("7");
  const [allowFloorOverride, setAllowFloorOverride] = useState(false);
  const [notes, setNotes] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ code: string; expiresAt: Date } | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedProduct = products.find((p) => p.id === productId) ?? null;
  const numericValue = Number(value);
  const floorPreview = (() => {
    if (!selectedProduct) return null;
    if (!Number.isFinite(numericValue) || numericValue <= 0) return null;
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
      <div className="space-y-4">
        <div className="rounded-2xl border border-green-200 bg-green-50 p-4">
          <div className="flex items-start gap-2">
            <CheckCircle2
              className="mt-0.5 h-5 w-5 text-green-700"
              strokeWidth={2}
            />
            <div className="flex-1">
              <p className="text-sm font-medium text-green-900">
                Coupon created
              </p>
              <p className="mt-2 rounded-lg bg-white px-3 py-2 text-center font-mono text-2xl font-semibold tracking-widest text-zinc-900 select-all">
                {success.code}
              </p>
              <p className="mt-2 text-xs text-green-800">
                Share this code with the customer. Expires{" "}
                {new Date(success.expiresAt).toLocaleString()}.
              </p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setSuccess(null)}
            className="flex-1 rounded-xl border-2 border-zinc-300 bg-white py-2.5 text-sm font-medium"
          >
            Create another
          </button>
          <button
            type="button"
            onClick={() => router.push("/coupons")}
            className="flex-1 rounded-xl bg-zinc-900 py-2.5 text-sm font-medium text-white"
          >
            Back to list
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div>
        <p className="mb-1.5 text-sm font-medium text-zinc-800">Discount type</p>
        <div className="grid grid-cols-2 gap-2">
          {(["PERCENT", "FIXED"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setType(t);
                setValue(t === "PERCENT" ? "10" : "500");
              }}
              className={`rounded-xl border-2 px-3 py-3 text-sm font-medium ${
                type === t
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : "border-zinc-300 bg-white text-zinc-700"
              }`}
            >
              {t === "PERCENT" ? "% off" : "RWF off"}
            </button>
          ))}
        </div>
      </div>

      <label className="block">
        <span className="text-sm font-medium text-zinc-800">
          {type === "PERCENT" ? "Percent off (1–100)" : "Amount off (RWF)"}
        </span>
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={type === "PERCENT" ? 100 : undefined}
          step={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          required
          className="mt-1 block w-full rounded-xl border-2 border-zinc-300 px-3 py-2.5 text-base tabular-nums"
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-zinc-800">
          Limit to a product (optional)
        </span>
        <select
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
          className="mt-1 block w-full rounded-xl border-2 border-zinc-300 px-3 py-2.5 text-base"
        >
          <option value="">Any product (cart-wide)</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.sku})
            </option>
          ))}
        </select>
        <span className="mt-1 block text-xs text-zinc-500">
          Cart-wide discounts apply to the whole sale; product-locked
          coupons only work on the chosen item.
        </span>
      </label>

      {floorPreview && selectedProduct && (
        <div
          className={`rounded-xl border p-3 text-xs ${
            floorPreview.belowCost
              ? "border-red-200 bg-red-50 text-red-800"
              : "border-zinc-200 bg-zinc-50 text-zinc-700"
          }`}
        >
          <p className="font-medium">Margin preview · {selectedProduct.name}</p>
          <p className="mt-1 font-mono tabular-nums">
            Cost {formatRWF(floorPreview.unitCost)} / unit · Sells for{" "}
            {formatRWF(selectedProduct.unitPrice)} · After discount{" "}
            {formatRWF(floorPreview.finalUnitPrice)}
          </p>
          {floorPreview.belowCost && (
            <p className="mt-1">
              Heads up — final price is below cost. The cashier won&apos;t be
              able to redeem this unless you tick &ldquo;Allow floor
              override&rdquo; below.
            </p>
          )}
        </div>
      )}

      <label className="block">
        <span className="text-sm font-medium text-zinc-800">Expires in (days)</span>
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={365}
          step={1}
          value={expiresInDays}
          onChange={(e) => setExpiresInDays(e.target.value)}
          required
          className="mt-1 block w-full rounded-xl border-2 border-zinc-300 px-3 py-2.5 text-base tabular-nums"
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-zinc-800">
          Custom code (optional)
        </span>
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Leave blank to auto-generate"
          spellCheck={false}
          autoCapitalize="characters"
          className="mt-1 block w-full rounded-xl border-2 border-zinc-300 px-3 py-2.5 text-base font-mono tabular-nums uppercase"
        />
        <span className="mt-1 block text-xs text-zinc-500">
          Auto-generated codes are 6 chars and exclude lookalike letters
          (0/O/I/1). Custom codes must be 4–20 letters or digits.
        </span>
      </label>

      <label className="block">
        <span className="text-sm font-medium text-zinc-800">
          Note (optional)
        </span>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Who is this for? (Wholesale buyer Jean-Paul …)"
          className="mt-1 block w-full rounded-xl border-2 border-zinc-300 px-3 py-2.5 text-base"
        />
      </label>

      <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm">
        <input
          type="checkbox"
          checked={allowFloorOverride}
          onChange={(e) => setAllowFloorOverride(e.target.checked)}
          className="mt-0.5 h-4 w-4"
        />
        <span>
          <span className="font-medium text-zinc-800">Allow floor override</span>
          <span className="block text-xs text-zinc-500">
            Lets this coupon redeem even if it breaches the minimum margin
            (audit-logged). Use for clearance or strategic loss-leaders.
          </span>
        </span>
      </label>

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-2xl bg-zinc-900 px-5 py-3 text-base font-semibold text-white hover:bg-zinc-800 disabled:opacity-60"
      >
        {isPending ? "Creating…" : "Create coupon"}
      </button>
    </form>
  );
}
