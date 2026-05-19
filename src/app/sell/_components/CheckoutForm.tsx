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
  const [paymentMethod, setPaymentMethod] = useState<
    "CASH" | "MOMO" | "BANK"
  >("CASH");
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
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-center text-sm text-zinc-600">
        Cart is empty.{" "}
        <Link href="/sell" className="text-zinc-900 underline">
          Add something
        </Link>
        .
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

      setSuccess(
        `Sale recorded: ${formatRWF(result.data.total)} (${result.data.saleId})`,
      );
      clear();
      setIdempotencyKey(crypto.randomUUID());
      // Auto-return to /sell after a moment
      setTimeout(() => router.push("/sell"), 1200);
    });
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

      <section className="rounded-2xl border border-zinc-200 bg-white">
        <ul className="divide-y divide-zinc-200">
          {cart.items.map((item, idx) => (
            <li
              key={`${item.productId}-${item.saleUnit}-${idx}`}
              className="flex items-center gap-3 p-3 text-sm"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{item.productName}</p>
                <p className="text-xs text-zinc-500">
                  {item.qty} × {item.saleUnit === "UNIT" ? "unit" : "carton"} ·{" "}
                  {formatRWF(item.unitPrice)}
                </p>
              </div>
              <span className="font-mono tabular-nums">
                {formatRWF(item.lineTotal)}
              </span>
              <button
                type="button"
                onClick={() => removeItem(idx)}
                className="text-xs text-red-600 hover:underline"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
        <div className="flex items-center justify-between border-t border-zinc-200 px-3 py-2 text-sm font-medium">
          <span>Total</span>
          <span className="font-mono text-base tabular-nums">
            {formatRWF(total)}
          </span>
        </div>
      </section>

      <section className="space-y-2">
        <p className="text-sm font-medium">Payment method</p>
        <div className="grid grid-cols-3 gap-2">
          {(["CASH", "MOMO", "BANK"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setPaymentMethod(m)}
              className={`rounded-2xl border px-3 py-3 text-sm font-medium transition ${
                paymentMethod === m
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : "border-zinc-300 bg-white hover:bg-zinc-50"
              }`}
            >
              {m === "CASH" ? "💵 Cash" : m === "MOMO" ? "📱 MoMo" : "🏦 Bank"}
            </button>
          ))}
        </div>
      </section>

      {paymentMethod !== "CASH" && (
        <label className="block">
          <span className="text-sm font-medium">Reference (optional)</span>
          <input
            type="text"
            value={paymentRef}
            onChange={(e) => setPaymentRef(e.target.value)}
            placeholder="Txn id, MoMo code, etc."
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
        </label>
      )}

      <div className="flex gap-2 pt-2">
        <Link
          href="/sell"
          className="flex-1 rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-center text-sm font-medium hover:bg-zinc-50"
        >
          Back
        </Link>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isPending}
          className="flex-[2] rounded-2xl bg-zinc-900 px-4 py-3 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
        >
          {isPending ? "Recording..." : `Complete sale · ${formatRWF(total)}`}
        </button>
      </div>
    </div>
  );
}
