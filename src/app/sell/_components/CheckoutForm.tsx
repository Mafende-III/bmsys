"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Banknote,
  CheckCircle2,
  Landmark,
  ShieldAlert,
  ShoppingCart,
  Smartphone,
  Tag,
  X,
} from "lucide-react";
import { formatRWF } from "@/lib/format";
import { createSale } from "@/lib/sales/actions";
import { maxAllowedLineDiscount } from "@/lib/sales/floor";
import { useCart, type CartItem } from "./CartProvider";

type DiscountDraft = {
  mode: "RWF" | "PCT";
  raw: string; // freeform input value
  reason: string;
  override: boolean;
};

const emptyDraft: DiscountDraft = {
  mode: "RWF",
  raw: "",
  reason: "",
  override: false,
};

function parseDraftAmount(item: CartItem, draft: DiscountDraft): number {
  const n = Number(draft.raw);
  if (!Number.isFinite(n) || n <= 0) return 0;
  if (draft.mode === "PCT") {
    return Math.max(0, Math.round((n / 100) * item.qty * item.unitPrice));
  }
  return Math.max(0, Math.round(n));
}

export function CheckoutForm({ isOwner = false }: { isOwner?: boolean }) {
  const router = useRouter();
  const {
    cart,
    subtotal,
    discountTotal,
    total,
    removeItem,
    setItemDiscount,
    clear,
    ready,
  } = useCart();
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
  // Per-line discount edit drafts keyed by cart index. Open ⇒ row is
  // showing inputs; absent ⇒ collapsed.
  const [drafts, setDrafts] = useState<Record<number, DiscountDraft>>({});

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
          discountAmount: i.discountAmount,
          discountReason: i.discountReason,
          floorOverride: i.floorOverride,
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
          {cart.items.map((item, idx) => (
            <CartLine
              key={`${item.productId}-${item.saleUnit}-${idx}`}
              item={item}
              draft={drafts[idx] ?? null}
              isOwner={isOwner}
              onOpenDiscount={() =>
                setDrafts((d) => ({
                  ...d,
                  [idx]: {
                    mode: "RWF",
                    raw: item.discountAmount > 0 ? String(item.discountAmount) : "",
                    reason: item.discountReason ?? "",
                    override: item.floorOverride,
                  },
                }))
              }
              onUpdateDraft={(next) =>
                setDrafts((d) => ({ ...d, [idx]: next }))
              }
              onApplyDraft={(next) => {
                const amount = parseDraftAmount(item, next);
                setItemDiscount(idx, amount, next.reason || null, next.override);
                setDrafts((d) => {
                  const copy = { ...d };
                  delete copy[idx];
                  return copy;
                });
              }}
              onClearDiscount={() => {
                setItemDiscount(idx, 0, null, false);
                setDrafts((d) => {
                  const copy = { ...d };
                  delete copy[idx];
                  return copy;
                });
              }}
              onCancelDraft={() =>
                setDrafts((d) => {
                  const copy = { ...d };
                  delete copy[idx];
                  return copy;
                })
              }
              onRemove={() => removeItem(idx)}
            />
          ))}
        </ul>

        <div className="space-y-1 border-t-2 border-zinc-200 bg-zinc-50 px-3 py-3 text-sm">
          <div className="flex items-center justify-between text-zinc-700">
            <span>Subtotal</span>
            <span className="font-mono tabular-nums">
              {formatRWF(subtotal)}
            </span>
          </div>
          {discountTotal > 0 && (
            <div className="flex items-center justify-between text-amber-700">
              <span>Discount</span>
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

      {/* Payment method */}
      <section>
        <p className="mb-2 text-sm font-medium text-zinc-700">
          How is the customer paying?
        </p>
        <div className="grid grid-cols-3 gap-2">
          {(["CASH", "MOMO", "BANK"] as const).map((m) => {
            const Icon = m === "CASH" ? Banknote : m === "MOMO" ? Smartphone : Landmark;
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

function CartLine({
  item,
  draft,
  isOwner,
  onOpenDiscount,
  onUpdateDraft,
  onApplyDraft,
  onClearDiscount,
  onCancelDraft,
  onRemove,
}: {
  item: CartItem;
  draft: DiscountDraft | null;
  isOwner: boolean;
  onOpenDiscount: () => void;
  onUpdateDraft: (d: DiscountDraft) => void;
  onApplyDraft: (d: DiscountDraft) => void;
  onClearDiscount: () => void;
  onCancelDraft: () => void;
  onRemove: () => void;
}) {
  const maxAtFloor = useMemo(
    () =>
      maxAllowedLineDiscount({
        saleUnit: item.saleUnit,
        qty: item.qty,
        unitPrice: item.unitPrice,
        costPerCarton: item.costPerCarton,
        unitsPerCarton: item.unitsPerCarton,
        marginBps: item.effectiveMarginBps,
      }),
    [item],
  );

  const draftAmount = draft ? parseDraftAmount(item, draft) : 0;
  const gross = item.qty * item.unitPrice;
  const overFloor = draft && draftAmount > maxAtFloor;
  const overGross = draft && draftAmount > gross;
  const draftReasonMissing = draft && draftAmount > 0 && draft.reason.trim() === "";
  const canApply =
    draft !== null &&
    !overGross &&
    (!overFloor || (isOwner && draft.override)) &&
    !draftReasonMissing;

  return (
    <li className="space-y-2 p-3 text-sm">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{item.productName}</p>
          <p className="text-xs text-zinc-500">
            {item.qty} × {item.saleUnit === "UNIT" ? "single" : "carton"} ·{" "}
            {formatRWF(item.unitPrice)}
          </p>
        </div>
        <span className="font-mono tabular-nums">
          {item.discountAmount > 0 ? (
            <>
              <span className="block text-[10px] text-zinc-400 line-through">
                {formatRWF(gross)}
              </span>
              <span className="block text-zinc-900">
                {formatRWF(item.lineTotal)}
              </span>
            </>
          ) : (
            formatRWF(item.lineTotal)
          )}
        </span>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove item"
          className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 hover:text-red-700"
        >
          <X className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>

      {/* Discount summary chip (when applied, no draft open) */}
      {item.discountAmount > 0 && !draft && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs">
          <Tag className="h-3.5 w-3.5 shrink-0 text-amber-700" strokeWidth={2} />
          <span className="font-mono text-amber-900">
            −{formatRWF(item.discountAmount)}
          </span>
          {item.discountReason && (
            <span className="truncate text-zinc-600">· {item.discountReason}</span>
          )}
          {item.floorOverride && (
            <span className="ml-auto inline-flex items-center gap-1 rounded-md bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700">
              <ShieldAlert className="h-3 w-3" strokeWidth={2} />
              floor overridden
            </span>
          )}
          <button
            type="button"
            onClick={onOpenDiscount}
            className="ml-auto text-amber-800 underline hover:no-underline"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={onClearDiscount}
            className="text-zinc-500 hover:text-red-700"
          >
            Remove
          </button>
        </div>
      )}

      {/* Apply discount link (collapsed) */}
      {item.discountAmount === 0 && !draft && (
        <button
          type="button"
          onClick={onOpenDiscount}
          className="inline-flex items-center gap-1 text-xs text-zinc-600 hover:text-zinc-900"
        >
          <Tag className="h-3.5 w-3.5" strokeWidth={2} /> Apply discount
        </button>
      )}

      {/* Inline editor (open draft) */}
      {draft && (
        <div className="space-y-2 rounded-lg border border-zinc-200 bg-zinc-50 p-2.5">
          <div className="flex items-center gap-2">
            <div className="flex overflow-hidden rounded-md border border-zinc-300">
              <button
                type="button"
                onClick={() => onUpdateDraft({ ...draft, mode: "RWF" })}
                className={`px-2.5 py-1 text-xs font-medium ${
                  draft.mode === "RWF"
                    ? "bg-zinc-900 text-white"
                    : "bg-white text-zinc-700"
                }`}
              >
                RWF
              </button>
              <button
                type="button"
                onClick={() => onUpdateDraft({ ...draft, mode: "PCT" })}
                className={`px-2.5 py-1 text-xs font-medium ${
                  draft.mode === "PCT"
                    ? "bg-zinc-900 text-white"
                    : "bg-white text-zinc-700"
                }`}
              >
                %
              </button>
            </div>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step={draft.mode === "PCT" ? "0.1" : "1"}
              value={draft.raw}
              onChange={(e) =>
                onUpdateDraft({ ...draft, raw: e.target.value })
              }
              placeholder={draft.mode === "PCT" ? "e.g. 10" : "e.g. 500"}
              className="block w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm tabular-nums"
            />
            <span className="font-mono text-xs text-zinc-600">
              = −{formatRWF(draftAmount)}
            </span>
          </div>
          <input
            type="text"
            value={draft.reason}
            onChange={(e) =>
              onUpdateDraft({ ...draft, reason: e.target.value })
            }
            placeholder="Reason (wholesale, regular customer, …)"
            className="block w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
          />
          {overGross && (
            <p className="text-xs text-red-700">
              Discount can&apos;t be more than {formatRWF(gross)}.
            </p>
          )}
          {!overGross && overFloor && (
            <p className="text-xs text-red-700">
              Max discount at the {(item.effectiveMarginBps / 100).toFixed(1)}%
              margin floor is {formatRWF(maxAtFloor)}.
              {isOwner && " Toggle override below to allow it."}
            </p>
          )}
          {draftReasonMissing && (
            <p className="text-xs text-red-700">
              Add a reason so the audit log can explain why.
            </p>
          )}
          {isOwner && overFloor && (
            <label className="flex cursor-pointer items-center gap-2 text-xs text-red-700">
              <input
                type="checkbox"
                checked={draft.override}
                onChange={(e) =>
                  onUpdateDraft({ ...draft, override: e.target.checked })
                }
                className="h-4 w-4"
              />
              Override floor (margin-breaking discount, audit-logged)
            </label>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onCancelDraft}
              className="rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-xs"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!canApply}
              onClick={() => onApplyDraft(draft)}
              className="rounded-md bg-zinc-900 px-2.5 py-1 text-xs font-medium text-white disabled:opacity-50"
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
