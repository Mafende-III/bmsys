"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Banknote,
  CheckCircle2,
  Landmark,
  ShoppingCart,
  Smartphone,
  Tag,
  X,
} from "lucide-react";
import { formatRWF } from "@/lib/format";
import { createSale } from "@/lib/sales/actions";
import { previewCoupon } from "@/lib/coupons/actions";
import type { CouponPreview } from "@/lib/coupons/operations";
import { useCart } from "./CartProvider";

export function CheckoutForm() {
  const router = useRouter();
  const { cart, subtotal, removeItem, setCouponCode, clear, ready } = useCart();
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
  // Coupon UX state. `codeInput` is the in-progress text; `preview`
  // is the validated server response (success or error) we show under
  // the input until the user clears it.
  const [codeInput, setCodeInput] = useState("");
  const [preview, setPreview] = useState<CouponPreview | null>(null);
  const [checking, setChecking] = useState(false);

  if (!ready) return null;

  if (!cart || cart.items.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-zinc-300 bg-zinc-50 p-8 text-center">
        <ShoppingCart
          className="mx-auto h-10 w-10 text-zinc-400"
          strokeWidth={1.5}
        />
        <p className="mt-3 text-base font-medium text-zinc-800">Empty cart</p>
        <p className="mt-1 text-sm text-zinc-600">
          Add something before you can pay.
        </p>
        <Link
          href="/sell"
          className="mt-4 inline-flex items-center gap-1 rounded-2xl bg-zinc-900 px-5 py-3 text-sm font-medium text-white hover:bg-zinc-800"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2} /> Back to categories
        </Link>
      </div>
    );
  }

  const discountTotal =
    preview && preview.ok ? preview.discountTotal : 0;
  const total = subtotal - discountTotal;
  const couponApplied = preview?.ok ? preview.code : null;

  async function applyCoupon() {
    if (!cart) return;
    const code = codeInput.trim().toUpperCase();
    if (code === "") return;
    setChecking(true);
    setError(null);
    try {
      const result = await previewCoupon(
        code,
        cart.items.map((i) => ({
          productId: i.productId,
          saleUnit: i.saleUnit,
          qty: i.qty,
        })),
        cart.channelId,
      );
      setPreview(result);
      if (result.ok) {
        setCouponCode(result.code);
      } else {
        setCouponCode(null);
      }
    } finally {
      setChecking(false);
    }
  }

  function dropCoupon() {
    setPreview(null);
    setCouponCode(null);
    setCodeInput("");
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
        couponCode: couponApplied,
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
      setPreview(null);
      setCodeInput("");
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
        <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          <CheckCircle2 className="h-5 w-5 shrink-0" strokeWidth={2} />
          <span>{success}</span>
        </div>
      )}

      {/* Cart items */}
      <section
        data-tour="checkout-lines"
        className="overflow-hidden rounded-2xl border-2 border-zinc-200 bg-white"
      >
        <ul className="divide-y divide-zinc-200">
          {cart.items.map((item, idx) => {
            const line = preview?.ok
              ? preview.perLine.find((l) => l.productId === item.productId)
              : null;
            const lineDiscount = line?.discount ?? 0;
            const lineFinal = item.qty * item.unitPrice - lineDiscount;
            return (
              <li
                key={`${item.productId}-${item.saleUnit}-${idx}`}
                className="flex items-center gap-3 p-3 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{item.productName}</p>
                  <p className="text-xs text-zinc-500">
                    {item.qty} ×{" "}
                    {item.saleUnit === "UNIT" ? "single" : "carton"} ·{" "}
                    {formatRWF(item.unitPrice)}
                  </p>
                  {lineDiscount > 0 && (
                    <p className="mt-0.5 text-xs text-amber-700">
                      − {formatRWF(lineDiscount)} from coupon
                    </p>
                  )}
                </div>
                <span className="font-mono tabular-nums text-right">
                  {lineDiscount > 0 ? (
                    <>
                      <span className="block text-[10px] text-zinc-400 line-through">
                        {formatRWF(item.qty * item.unitPrice)}
                      </span>
                      <span className="block text-zinc-900">
                        {formatRWF(lineFinal)}
                      </span>
                    </>
                  ) : (
                    formatRWF(item.qty * item.unitPrice)
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    removeItem(idx);
                    // Removing an item invalidates the preview
                    setPreview(null);
                    setCodeInput("");
                  }}
                  aria-label="Remove item"
                  className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 hover:text-red-700"
                >
                  <X className="h-4 w-4" strokeWidth={2} />
                </button>
              </li>
            );
          })}
        </ul>

        <div className="space-y-1 border-t-2 border-zinc-200 bg-zinc-50 px-3 py-3 text-sm">
          <div className="flex items-center justify-between text-zinc-700">
            <span>Subtotal</span>
            <span className="font-mono tabular-nums">
              {formatRWF(subtotal)}
            </span>
          </div>
          {discountTotal > 0 && couponApplied && (
            <div className="flex items-center justify-between text-amber-700">
              <span>Coupon {couponApplied}</span>
              <span className="font-mono tabular-nums">
                −{formatRWF(discountTotal)}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between pt-1 text-base font-semibold">
            <span>Total</span>
            <span className="font-mono text-lg tabular-nums">
              {formatRWF(total)}
            </span>
          </div>
        </div>
      </section>

      {/* Coupon */}
      <section
        data-tour="checkout-coupon"
        className="rounded-2xl border-2 border-zinc-200 bg-white p-3"
      >
        <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-zinc-700">
          <Tag className="h-4 w-4" strokeWidth={2} />
          Coupon code
        </p>
        {couponApplied && preview?.ok ? (
          <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-mono text-base font-semibold text-amber-900">
                  {preview.code}
                </p>
                <p className="text-xs text-amber-800">
                  {formatRWF(preview.discountTotal)} off
                  {preview.productScope
                    ? ` · ${preview.productScope.name}`
                    : " · whole cart"}
                  {preview.floorOverride
                    ? " · margin floor overridden"
                    : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={dropCoupon}
                className="text-xs text-zinc-600 underline hover:no-underline"
              >
                Remove
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-stretch gap-2">
              <input
                type="text"
                value={codeInput}
                onChange={(e) => {
                  setCodeInput(e.target.value);
                  if (preview) setPreview(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void applyCoupon();
                  }
                }}
                placeholder="e.g. H8X2KQ"
                spellCheck={false}
                autoCapitalize="characters"
                className="block flex-1 rounded-xl border-2 border-zinc-300 px-3 py-2.5 text-base font-mono tracking-wider tabular-nums uppercase placeholder:normal-case placeholder:font-sans placeholder:tracking-normal"
              />
              <button
                type="button"
                onClick={() => void applyCoupon()}
                disabled={checking || codeInput.trim() === ""}
                className="rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white disabled:opacity-50"
              >
                {checking ? "Checking…" : "Apply"}
              </button>
            </div>
            {preview && !preview.ok && (
              <p className="text-xs text-red-700">{preview.error}</p>
            )}
            <p className="text-[11px] text-zinc-500">
              Ask the owner for a one-time coupon code if a customer is
              promised a discount.
            </p>
          </div>
        )}
      </section>

      {/* Payment method */}
      <section>
        <p className="mb-2 text-sm font-medium text-zinc-700">
          How is the customer paying?
        </p>
        <div className="grid grid-cols-3 gap-2">
          {(["CASH", "MOMO", "BANK"] as const).map((m) => {
            const Icon =
              m === "CASH" ? Banknote : m === "MOMO" ? Smartphone : Landmark;
            return (
              <button
                key={m}
                type="button"
                onClick={() => setPaymentMethod(m)}
                className={`flex flex-col items-center gap-2 rounded-2xl border-2 px-3 py-4 transition active:scale-95 ${
                  paymentMethod === m
                    ? "border-zinc-900 bg-zinc-900 text-white"
                    : "border-zinc-300 bg-white text-zinc-900 hover:border-zinc-400"
                }`}
              >
                <Icon className="h-7 w-7" strokeWidth={1.5} />
                <span className="text-sm font-medium">
                  {m === "CASH" ? "Cash" : m === "MOMO" ? "MoMo" : "Bank"}
                </span>
              </button>
            );
          })}
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
        className="flex items-center justify-center gap-1 text-sm text-zinc-600 hover:underline"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2} /> Back to shopping
      </Link>
    </div>
  );
}
