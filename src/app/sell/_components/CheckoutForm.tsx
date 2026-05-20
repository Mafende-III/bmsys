"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatRWF } from "@/lib/format";
import { createSale } from "@/lib/sales/actions";
import { useCart } from "./CartProvider";

export function CheckoutForm() {
  const router = useRouter();
  const { cart, total, removeItem, clear, ready } = useCart();
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "MOMO" | "BANK">(
    "CASH",
  );
  const [paymentRef, setPaymentRef] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [idempotencyKey, setIdempotencyKey] = useState(() =>
    crypto.randomUUID(),
  );

  if (!ready) return null;

  if (!cart || cart.items.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-zinc-300 bg-zinc-50 p-8 text-center">
        <p className="text-4xl" aria-hidden>
          🛒
        </p>
        <p className="mt-3 text-base font-medium text-zinc-800">Empty cart</p>
        <p className="mt-1 text-sm text-zinc-600">
          Add something before you can pay.
        </p>
        <Link
          href="/sell"
          className="mt-4 inline-block rounded-2xl bg-zinc-900 px-5 py-3 text-sm font-medium text-white hover:bg-zinc-800"
        >
          Back to categories
        </Link>
      </div>
    );
  }

  function handleSubmit() {
    if (!cart) return;
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      const result = await createSale(idempotencyKey, {
        channelId: cart.channelId,
        paymentMethod,
        paymentReference: paymentRef,
        items: cart.items.map((i) => ({
          productId: i.productId,
          saleUnit: i.saleUnit,
          qty: i.qty,
        })),
      });

      if (!result.ok) {
        setError(result.error);
        setIdempotencyKey(crypto.randomUUID());
        return;
      }

      setSuccess(`Sale done — ${formatRWF(result.data.total)} recorded.`);
      clear();
      setIdempotencyKey(crypto.randomUUID());
      setTimeout(() => router.push("/sell"), 1200);
    });
  }

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          ✓ {success}
        </div>
      )}

      {/* Cart items */}
      <section className="overflow-hidden rounded-2xl border-2 border-zinc-200 bg-white">
        <ul className="divide-y divide-zinc-200">
          {cart.items.map((item, idx) => (
            <li
              key={`${item.productId}-${item.saleUnit}-${idx}`}
              className="flex items-center gap-3 p-3 text-sm"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{item.productName}</p>
                <p className="text-xs text-zinc-500">
                  {item.qty} × {item.saleUnit === "UNIT" ? "single" : "carton"}{" "}
                  · {formatRWF(item.unitPrice)}
                </p>
              </div>
              <span className="font-mono tabular-nums">
                {formatRWF(item.lineTotal)}
              </span>
              <button
                type="button"
                onClick={() => removeItem(idx)}
                aria-label="Remove item"
                className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 hover:text-red-700"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
        <div className="flex items-center justify-between border-t-2 border-zinc-200 bg-zinc-50 px-3 py-3 text-base font-semibold">
          <span>Total</span>
          <span className="font-mono text-lg tabular-nums">
            {formatRWF(total)}
          </span>
        </div>
      </section>

      {/* Payment method */}
      <section>
        <p className="mb-2 text-sm font-medium text-zinc-700">
          How is the customer paying?
        </p>
        <div className="grid grid-cols-3 gap-2">
          {(["CASH", "MOMO", "BANK"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setPaymentMethod(m)}
              className={`flex flex-col items-center gap-1 rounded-2xl border-2 px-3 py-4 transition active:scale-95 ${
                paymentMethod === m
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : "border-zinc-300 bg-white text-zinc-900 hover:border-zinc-400"
              }`}
            >
              <span className="text-2xl" aria-hidden>
                {m === "CASH" ? "💵" : m === "MOMO" ? "📱" : "🏦"}
              </span>
              <span className="text-sm font-medium">
                {m === "CASH" ? "Cash" : m === "MOMO" ? "MoMo" : "Bank"}
              </span>
            </button>
          ))}
        </div>
      </section>

      {paymentMethod !== "CASH" && (
        <label className="block">
          <span className="text-sm font-medium text-zinc-700">
            Reference (optional)
          </span>
          <input
            type="text"
            value={paymentRef}
            onChange={(e) => setPaymentRef(e.target.value)}
            placeholder={
              paymentMethod === "MOMO"
                ? "MoMo transaction code"
                : "Bank reference"
            }
            className="mt-1 block w-full rounded-xl border-2 border-zinc-300 px-3 py-3 text-base"
          />
        </label>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={isPending}
        className="w-full rounded-2xl bg-zinc-900 px-5 py-5 text-lg font-semibold text-white shadow-md transition hover:bg-zinc-800 active:scale-[0.98] disabled:opacity-60"
      >
        {isPending ? "Recording…" : `Pay ${formatRWF(total)}`}
      </button>

      <Link
        href="/sell"
        className="block text-center text-sm text-zinc-600 hover:underline"
      >
        ← Back to shopping
      </Link>
    </div>
  );
}
