"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Product } from "@prisma/client";
import { formatRWF } from "@/lib/format";
import { createProduct, updateProduct } from "@/lib/products/actions";

type Mode =
  | { kind: "create" }
  | { kind: "edit"; id: string; product: Product };

type Initial = {
  sku: string;
  name: string;
  category: string;
  unitsPerCarton: number;
  costPerCarton: number;
  unitPrice: number;
  cartonPrice: number;
  sellableAsUnit: boolean;
  sellableAsCarton: boolean;
  lowStockThresholdUnits: number;
  loyaltyPointsPerUnit: number;
};

function initialFromMode(mode: Mode): Initial {
  if (mode.kind === "edit") {
    return {
      sku: mode.product.sku,
      name: mode.product.name,
      category: mode.product.category ?? "",
      unitsPerCarton: mode.product.unitsPerCarton,
      costPerCarton: mode.product.costPerCarton,
      unitPrice: mode.product.unitPrice,
      cartonPrice: mode.product.cartonPrice,
      sellableAsUnit: mode.product.sellableAsUnit,
      sellableAsCarton: mode.product.sellableAsCarton,
      lowStockThresholdUnits: mode.product.lowStockThresholdUnits,
      loyaltyPointsPerUnit: mode.product.loyaltyPointsPerUnit,
    };
  }
  return {
    sku: "",
    name: "",
    category: "",
    unitsPerCarton: 12,
    costPerCarton: 0,
    unitPrice: 0,
    cartonPrice: 0,
    sellableAsUnit: true,
    sellableAsCarton: true,
    lowStockThresholdUnits: 0,
    loyaltyPointsPerUnit: 0,
  };
}

export function ProductForm({
  mode,
  categories,
}: {
  mode: Mode;
  categories: string[];
}) {
  const router = useRouter();
  const initial = initialFromMode(mode);

  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [idempotencyKey, setIdempotencyKey] = useState(() =>
    crypto.randomUUID(),
  );

  // Live state for margin preview
  const [unitsPerCarton, setUnitsPerCarton] = useState(initial.unitsPerCarton);
  const [costPerCarton, setCostPerCarton] = useState(initial.costPerCarton);
  const [unitPrice, setUnitPrice] = useState(initial.unitPrice);
  const [cartonPrice, setCartonPrice] = useState(initial.cartonPrice);

  const margins = useMemo(() => {
    if (unitsPerCarton <= 0) return null;
    const costPerUnit = Math.round(costPerCarton / unitsPerCarton);
    const unitMargin = unitPrice - costPerUnit;
    const unitPct =
      costPerUnit > 0 ? Math.round((unitMargin / costPerUnit) * 100) : 0;
    const cartonMargin = cartonPrice - costPerCarton;
    const cartonPct =
      costPerCarton > 0 ? Math.round((cartonMargin / costPerCarton) * 100) : 0;
    return { costPerUnit, unitMargin, unitPct, cartonMargin, cartonPct };
  }, [unitsPerCarton, costPerCarton, unitPrice, cartonPrice]);

  function handleSubmit(formData: FormData) {
    setError(null);

    const data: Record<string, unknown> = {
      name: String(formData.get("name") ?? ""),
      category: String(formData.get("category") ?? ""),
      unitsPerCarton: Number(formData.get("unitsPerCarton") ?? 0),
      costPerCarton: Number(formData.get("costPerCarton") ?? 0),
      unitPrice: Number(formData.get("unitPrice") ?? 0),
      cartonPrice: Number(formData.get("cartonPrice") ?? 0),
      sellableAsUnit: formData.get("sellableAsUnit") === "on",
      sellableAsCarton: formData.get("sellableAsCarton") === "on",
      lowStockThresholdUnits: Number(formData.get("lowStockThresholdUnits") ?? 0),
      loyaltyPointsPerUnit: Number(formData.get("loyaltyPointsPerUnit") ?? 0),
    };
    if (mode.kind === "create") {
      data.sku = String(formData.get("sku") ?? "");
    }

    startTransition(async () => {
      const result =
        mode.kind === "create"
          ? await createProduct(idempotencyKey, data)
          : await updateProduct(idempotencyKey, mode.id, data);

      if (!result.ok) {
        setError(result.error);
        setIdempotencyKey(crypto.randomUUID());
        return;
      }

      if (mode.kind === "create") {
        router.push(`/products/${result.data.id}`);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <label className="block">
        <span className="text-sm font-medium">SKU</span>
        {mode.kind === "edit" ? (
          <input
            value={mode.product.sku}
            disabled
            className="mt-1 block w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-500"
          />
        ) : (
          <input
            type="text"
            name="sku"
            required
            defaultValue={initial.sku}
            placeholder="e.g. WATER-500ML"
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
          />
        )}
        <span className="mt-1 block text-xs text-zinc-500">
          Cannot be changed once created.
        </span>
      </label>

      <label className="block">
        <span className="text-sm font-medium">Name</span>
        <input
          type="text"
          name="name"
          required
          defaultValue={initial.name}
          className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium">Category</span>
        <input
          type="text"
          name="category"
          list="product-categories"
          defaultValue={initial.category}
          placeholder="e.g. Water, Beer, Soda"
          className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
        />
        <datalist id="product-categories">
          {categories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-sm font-medium">Units per carton</span>
          <input
            type="number"
            name="unitsPerCarton"
            required
            min={1}
            step={1}
            value={unitsPerCarton}
            onChange={(e) => setUnitsPerCarton(Number(e.target.value || 0))}
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Cost per carton (RWF)</span>
          <input
            type="number"
            name="costPerCarton"
            required
            min={0}
            step={1}
            value={costPerCarton}
            onChange={(e) => setCostPerCarton(Number(e.target.value || 0))}
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-sm font-medium">Unit price (RWF)</span>
          <input
            type="number"
            name="unitPrice"
            required
            min={0}
            step={1}
            value={unitPrice}
            onChange={(e) => setUnitPrice(Number(e.target.value || 0))}
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Carton price (RWF)</span>
          <input
            type="number"
            name="cartonPrice"
            required
            min={0}
            step={1}
            value={cartonPrice}
            onChange={(e) => setCartonPrice(Number(e.target.value || 0))}
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
          />
        </label>
      </div>

      {margins && (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm">
          <p className="font-medium text-zinc-800">Margin preview</p>
          <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-zinc-700">
            <dt>Cost per unit</dt>
            <dd className="text-right font-mono">
              {formatRWF(margins.costPerUnit)}
            </dd>
            <dt>Unit margin</dt>
            <dd
              className={`text-right font-mono ${margins.unitMargin < 0 ? "text-red-700" : "text-green-700"}`}
            >
              {formatRWF(margins.unitMargin)} ({margins.unitPct >= 0 ? "+" : ""}
              {margins.unitPct}%)
            </dd>
            <dt>Carton margin</dt>
            <dd
              className={`text-right font-mono ${margins.cartonMargin < 0 ? "text-red-700" : "text-green-700"}`}
            >
              {formatRWF(margins.cartonMargin)} (
              {margins.cartonPct >= 0 ? "+" : ""}
              {margins.cartonPct}%)
            </dd>
          </dl>
        </div>
      )}

      <fieldset className="rounded-lg border border-zinc-200 px-4 py-3">
        <legend className="px-1 text-sm font-medium">Sellable as</legend>
        <div className="mt-1 flex gap-6">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="sellableAsUnit"
              defaultChecked={initial.sellableAsUnit}
              className="h-4 w-4 rounded border-zinc-300"
            />
            Unit
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="sellableAsCarton"
              defaultChecked={initial.sellableAsCarton}
              className="h-4 w-4 rounded border-zinc-300"
            />
            Carton
          </label>
        </div>
      </fieldset>

      <details className="rounded-lg border border-zinc-200 px-4 py-2">
        <summary className="cursor-pointer text-sm font-medium">
          Advanced
        </summary>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium">
              Low-stock threshold (units)
            </span>
            <input
              type="number"
              name="lowStockThresholdUnits"
              min={0}
              step={1}
              defaultValue={initial.lowStockThresholdUnits}
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Loyalty points per unit</span>
            <input
              type="number"
              name="loyaltyPointsPerUnit"
              min={0}
              step={1}
              defaultValue={initial.loyaltyPointsPerUnit}
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
          </label>
        </div>
      </details>

      <div className="flex gap-2 pt-2">
        <Link
          href="/products"
          className="flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-center text-sm font-medium hover:bg-zinc-50"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={isPending}
          className="flex-1 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
        >
          {isPending
            ? "Saving..."
            : mode.kind === "create"
              ? "Create product"
              : "Save changes"}
        </button>
      </div>
    </form>
  );
}
