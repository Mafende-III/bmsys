"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createAdjustment } from "@/lib/adjustments/actions";
import { ADJUSTMENT_REASONS, type AdjustmentReason } from "@/lib/adjustments/schema";
import { ADJUSTMENT_LABEL } from "@/lib/copy";

type ProductOption = {
  id: string;
  sku: string;
  name: string;
  unitsPerCarton: number;
  stockUnits: number;
};

export function AdjustmentForm({ products }: { products: ProductOption[] }) {
  const router = useRouter();

  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [reason, setReason] = useState<AdjustmentReason>("ADJUSTMENT_BREAKAGE");
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [idempotencyKey, setIdempotencyKey] = useState(() =>
    crypto.randomUUID(),
  );

  const selectedProduct = products.find((p) => p.id === productId);
  const remaining = (selectedProduct?.stockUnits ?? 0) - qty;

  function handleSubmit() {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const r = await createAdjustment(idempotencyKey, {
        productId,
        reason,
        qtyUnits: qty,
        note,
      });
      if (!r.ok) {
        setError(r.error);
        setIdempotencyKey(crypto.randomUUID());
        return;
      }
      setSuccess(
        `Recorded. ${qty} unit(s) deducted; ${r.data.remainingStock} unit(s) remain.`,
      );
      setNote("");
      setQty(1);
      setIdempotencyKey(crypto.randomUUID());
      router.refresh();
    });
  }

  if (products.length === 0) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        No active products with stock.{" "}
        <Link href="/purchases/new" className="underline">
          Receive some stock first
        </Link>
        .
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {success}
        </div>
      )}

      <label className="block">
        <span className="text-sm font-medium">Product</span>
        <select
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
          className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        >
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.sku}) — {p.stockUnits} units
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="text-sm font-medium">Reason</span>
        <select
          value={reason}
          onChange={(e) => setReason(e.target.value as AdjustmentReason)}
          className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        >
          {ADJUSTMENT_REASONS.map((r) => (
            <option key={r} value={r}>
              {ADJUSTMENT_LABEL[r] ?? r}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="text-sm font-medium">Quantity (units to deduct)</span>
        <input
          type="number"
          min={1}
          step={1}
          value={qty}
          onChange={(e) =>
            setQty(Math.max(1, Math.floor(Number(e.target.value || 1))))
          }
          className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-lg font-mono tabular-nums focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
        />
        {selectedProduct && (
          <span
            className={`mt-1 block text-xs ${remaining < 0 ? "text-red-700" : "text-zinc-500"}`}
          >
            {selectedProduct.stockUnits} in stock → {remaining} after
          </span>
        )}
      </label>

      <label className="block">
        <span className="text-sm font-medium">Note (required)</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          required
          placeholder="What happened? e.g. 'Dropped 2 bottles on counter', 'Expired in July', 'Personal use for owner'"
          className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
        />
      </label>

      <div className="flex gap-2 pt-2">
        <Link
          href="/adjustments"
          className="flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-center text-sm font-medium hover:bg-zinc-50"
        >
          Cancel
        </Link>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isPending || remaining < 0 || note.trim() === ""}
          className="flex-1 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
        >
          {isPending ? "Recording..." : "Record adjustment"}
        </button>
      </div>
    </div>
  );
}
