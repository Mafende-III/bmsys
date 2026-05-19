"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatRWF } from "@/lib/format";
import { useCart } from "./CartProvider";

export function AddToCartForm({
  product,
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
  };
}) {
  const router = useRouter();
  const { addItem } = useCart();

  const defaultUnit: "UNIT" | "CARTON" =
    product.sellableAsUnit ? "UNIT" : "CARTON";

  const [saleUnit, setSaleUnit] = useState<"UNIT" | "CARTON">(defaultUnit);
  const [qty, setQty] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const unitPrice = saleUnit === "UNIT" ? product.unitPrice : product.cartonPrice;
  const lineTotal = useMemo(() => unitPrice * qty, [unitPrice, qty]);

  const maxQty =
    saleUnit === "UNIT" ? product.unitsPerCarton : product.sealedCartons;

  function handleAdd() {
    setError(null);

    if (saleUnit === "UNIT") {
      if (qty < 1) return setError("Qty must be at least 1");
      if (qty > product.unitsPerCarton) {
        return setError(
          `Max ${product.unitsPerCarton} per unit-sale (carton size). Pick CARTON instead.`,
        );
      }
      const totalAvailable = product.openedUnits + product.sealedCartons * product.unitsPerCarton;
      if (totalAvailable < qty) {
        return setError(`Out of stock (${totalAvailable} unit(s) available)`);
      }
    } else {
      if (qty < 1) return setError("Qty must be at least 1");
      if (product.sealedCartons < qty) {
        return setError(
          `Only ${product.sealedCartons} sealed carton(s) available`,
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
    });

    router.push("/sell");
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => {
            setSaleUnit("UNIT");
            setQty(1);
          }}
          disabled={!product.sellableAsUnit}
          className={`rounded-2xl border px-3 py-3 text-sm font-medium transition disabled:opacity-50 ${
            saleUnit === "UNIT"
              ? "border-zinc-900 bg-zinc-900 text-white"
              : "border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-50"
          }`}
        >
          Per unit
          <div className="mt-1 text-xs font-normal opacity-80">
            {formatRWF(product.unitPrice)}
          </div>
        </button>
        <button
          type="button"
          onClick={() => {
            setSaleUnit("CARTON");
            setQty(1);
          }}
          disabled={!product.sellableAsCarton}
          className={`rounded-2xl border px-3 py-3 text-sm font-medium transition disabled:opacity-50 ${
            saleUnit === "CARTON"
              ? "border-zinc-900 bg-zinc-900 text-white"
              : "border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-50"
          }`}
        >
          Per carton
          <div className="mt-1 text-xs font-normal opacity-80">
            {formatRWF(product.cartonPrice)}
          </div>
        </button>
      </div>

      <div>
        <p className="text-sm font-medium">Quantity</p>
        <div className="mt-1 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setQty(Math.max(1, qty - 1))}
            className="h-12 w-12 rounded-2xl border border-zinc-300 bg-white text-xl font-medium hover:bg-zinc-50"
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
            className="h-12 flex-1 rounded-2xl border border-zinc-300 bg-white text-center text-2xl font-semibold tabular-nums"
          />
          <button
            type="button"
            onClick={() => setQty(qty + 1)}
            className="h-12 w-12 rounded-2xl border border-zinc-300 bg-white text-xl font-medium hover:bg-zinc-50"
          >
            +
          </button>
        </div>
        {maxQty > 0 && saleUnit === "CARTON" && (
          <p className="mt-1 text-xs text-zinc-500">
            {product.sealedCartons} sealed carton(s) available
          </p>
        )}
        {saleUnit === "UNIT" && (
          <p className="mt-1 text-xs text-zinc-500">
            Max {product.unitsPerCarton} per UNIT line; pick CARTON for more
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
        <div className="flex items-center justify-between text-sm">
          <span>{qty} × {formatRWF(unitPrice)}</span>
          <span className="font-mono text-lg font-semibold tabular-nums">
            {formatRWF(lineTotal)}
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={handleAdd}
        className="w-full rounded-2xl bg-zinc-900 px-4 py-4 text-base font-medium text-white hover:bg-zinc-800"
      >
        Add to cart
      </button>
    </div>
  );
}
