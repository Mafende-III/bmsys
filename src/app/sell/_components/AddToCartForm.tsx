"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { formatRWF } from "@/lib/format";
import { useCart } from "./CartProvider";

export function AddToCartForm({
  product,
  effectiveMarginBps,
}: {
  product: {
    id: string;
    sku: string;
    name: string;
    unitsPerCarton: number;
    sellableAsUnit: boolean;
    sellableAsCarton: boolean;
    unitPrice: number;
    cartonPrice: number;
    sealedCartons: number;
    openedUnits: number;
    costPerCarton: number;
  };
  effectiveMarginBps: number;
}) {
  const router = useRouter();
  const t = useTranslations("sell");
  const { addItem } = useCart();

  const defaultUnit: "UNIT" | "CARTON" = product.sellableAsUnit
    ? "UNIT"
    : "CARTON";

  const [saleUnit, setSaleUnit] = useState<"UNIT" | "CARTON">(defaultUnit);
  const [qty, setQty] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const unitPrice =
    saleUnit === "UNIT" ? product.unitPrice : product.cartonPrice;
  const lineTotal = useMemo(() => unitPrice * qty, [unitPrice, qty]);

  function handleAdd() {
    setError(null);

    if (saleUnit === "UNIT") {
      if (qty < 1) return setError("Type at least 1");
      if (qty > product.unitsPerCarton) {
        return setError(
          `Max ${product.unitsPerCarton} when selling singles. Switch to "Whole carton" for more.`,
        );
      }
      const totalAvailable =
        product.openedUnits + product.sealedCartons * product.unitsPerCarton;
      if (totalAvailable < qty) {
        return setError(
          `Out of stock — only ${totalAvailable} ${totalAvailable === 1 ? "single" : "singles"} left.`,
        );
      }
    } else {
      if (qty < 1) return setError("Type at least 1");
      if (product.sealedCartons < qty) {
        return setError(
          `Out of stock — only ${product.sealedCartons} sealed carton${product.sealedCartons === 1 ? "" : "s"} left.`,
        );
      }
    }

    addItem({
      productId: product.id,
      productSku: product.sku,
      productName: product.name,
      saleUnit,
      qty,
      unitPrice,
      lineTotal,
      costPerCarton: product.costPerCarton,
      unitsPerCarton: product.unitsPerCarton,
      effectiveMarginBps,
      discountAmount: 0,
      discountReason: null,
      floorOverride: false,
    });

    router.push("/sell");
  }

  return (
    <div data-tour="add-to-cart-form" className="space-y-5">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Selling unit — two big tap cards */}
      <div>
        <p className="mb-2 text-sm font-medium text-zinc-700">
          {t("sellingAs")}
        </p>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => {
              setSaleUnit("UNIT");
              setQty(1);
            }}
            disabled={!product.sellableAsUnit}
            className={`rounded-2xl border-2 px-4 py-4 text-center transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 ${
              saleUnit === "UNIT"
                ? "border-zinc-900 bg-zinc-900 text-white"
                : "border-zinc-300 bg-white text-zinc-900 hover:border-zinc-400"
            }`}
          >
            <p className="text-base font-semibold">{t("asUnits")}</p>
            <p
              className={`mt-1 font-mono text-sm tabular-nums ${saleUnit === "UNIT" ? "text-zinc-200" : "text-zinc-700"}`}
            >
              {formatRWF(product.unitPrice)}
            </p>
          </button>
          <button
            type="button"
            onClick={() => {
              setSaleUnit("CARTON");
              setQty(1);
            }}
            disabled={!product.sellableAsCarton}
            className={`rounded-2xl border-2 px-4 py-4 text-center transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 ${
              saleUnit === "CARTON"
                ? "border-zinc-900 bg-zinc-900 text-white"
                : "border-zinc-300 bg-white text-zinc-900 hover:border-zinc-400"
            }`}
          >
            <p className="text-base font-semibold">{t("asCartons")}</p>
            <p
              className={`mt-1 font-mono text-sm tabular-nums ${saleUnit === "CARTON" ? "text-zinc-200" : "text-zinc-700"}`}
            >
              {formatRWF(product.cartonPrice)}
            </p>
          </button>
        </div>
      </div>

      {/* Quantity stepper — large */}
      <div>
        <p className="mb-2 text-sm font-medium text-zinc-700">{t("howMany")}</p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setQty(Math.max(1, qty - 1))}
            aria-label="Decrease quantity"
            className="h-16 w-16 shrink-0 rounded-2xl border-2 border-zinc-300 bg-white text-3xl font-medium hover:bg-zinc-50 active:scale-95"
          >
            −
          </button>
          <input
            type="number"
            min={1}
            value={qty}
            onChange={(e) =>
              setQty(Math.max(1, Math.floor(Number(e.target.value || 1))))
            }
            className="h-16 w-full min-w-0 flex-1 rounded-2xl border-2 border-zinc-300 bg-white text-center text-3xl font-semibold tabular-nums"
          />
          <button
            type="button"
            onClick={() => setQty(qty + 1)}
            aria-label="Increase quantity"
            className="h-16 w-16 shrink-0 rounded-2xl border-2 border-zinc-300 bg-white text-3xl font-medium hover:bg-zinc-50 active:scale-95"
          >
            +
          </button>
        </div>
        {saleUnit === "UNIT" && (
          <p className="mt-2 text-xs text-zinc-500">
            Up to {product.unitsPerCarton} per ticket. For more, switch to
            &quot;Whole carton&quot;.
          </p>
        )}
        {saleUnit === "CARTON" && product.sealedCartons > 0 && (
          <p className="mt-2 text-xs text-zinc-500">
            {product.sealedCartons} sealed carton
            {product.sealedCartons === 1 ? "" : "s"} available.
          </p>
        )}
      </div>

      {/* Total preview */}
      <div className="rounded-2xl border-2 border-zinc-200 bg-zinc-50 px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-zinc-700">
            {qty} × {formatRWF(unitPrice)}
          </span>
          <span className="font-mono text-2xl font-semibold tabular-nums">
            {formatRWF(lineTotal)}
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={handleAdd}
        className="w-full rounded-2xl bg-zinc-900 px-5 py-5 text-lg font-semibold text-white shadow-md transition hover:bg-zinc-800 active:scale-[0.98]"
      >
        {t("addToCart")}
      </button>
    </div>
  );
}
