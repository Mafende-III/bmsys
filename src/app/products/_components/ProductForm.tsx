"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { Product } from "@prisma/client";
import { formatRWF } from "@/lib/format";
import {
  createProduct,
  removeProductIcon,
  updateProduct,
  uploadProductIcon,
} from "@/lib/products/actions";
import { IconImageUpload } from "@/app/_components/IconImageUpload";
import { IconPicker } from "@/app/_components/IconPicker";
import { iconForKey } from "@/lib/icons";

type CategoryOption = {
  id: string;
  name: string;
  iconKey: string | null;
  iconEmoji: string;
};

type Mode =
  | { kind: "create" }
  | { kind: "edit"; id: string; product: Product };

type Initial = {
  sku: string;
  name: string;
  categoryId: string;
  iconKey: string | null;
  iconEmoji: string;
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
      categoryId: mode.product.categoryId ?? "",
      iconKey: mode.product.iconKey,
      iconEmoji: mode.product.iconEmoji ?? "",
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
    categoryId: "",
    iconKey: null,
    iconEmoji: "",
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
  categories: CategoryOption[];
}) {
  const tForm = useTranslations("products.form");
  const editingId = mode.kind === "edit" ? mode.id : null;
  const initialImageUrl =
    mode.kind === "edit" && mode.product.iconImagePath
      ? `/uploads/${mode.product.iconImagePath}?v=${Date.now()}`
      : null;
  const router = useRouter();
  const initial = initialFromMode(mode);

  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [idempotencyKey, setIdempotencyKey] = useState(() =>
    crypto.randomUUID(),
  );

  // Live state
  const [categoryId, setCategoryId] = useState(initial.categoryId);
  const [iconKey, setIconKey] = useState<string | null>(initial.iconKey);
  const [iconEmoji, setIconEmoji] = useState(initial.iconEmoji);
  const [unitsPerCarton, setUnitsPerCarton] = useState(initial.unitsPerCarton);
  const [costPerCarton, setCostPerCarton] = useState(initial.costPerCarton);
  const [unitPrice, setUnitPrice] = useState(initial.unitPrice);
  const [cartonPrice, setCartonPrice] = useState(initial.cartonPrice);

  const selectedCategory = categories.find((c) => c.id === categoryId);
  const effectiveIconKey = iconKey ?? selectedCategory?.iconKey ?? null;
  const EffectiveIcon = effectiveIconKey ? iconForKey(effectiveIconKey) : null;
  const effectiveEmoji =
    iconEmoji || selectedCategory?.iconEmoji || "📦";

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
      categoryId: categoryId || "",
      iconKey: iconKey ?? "",
      iconEmoji: iconEmoji || "",
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

      <label className="block" data-tour="product-sku">
        <span className="text-sm font-medium">Product code</span>
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
          A short unique code (e.g. WATER-500ML). Cannot be changed later.
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
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        >
          <option value="">— Uncategorised —</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.iconEmoji} {c.name}
            </option>
          ))}
        </select>
        {categories.length === 0 && (
          <span className="mt-1 block text-xs text-amber-700">
            No categories yet.{" "}
            <a href="/categories/new" className="underline">
              Add one
            </a>
            .
          </span>
        )}
      </label>

      {editingId && (
        <IconImageUpload
          initialUrl={initialImageUrl}
          upload={(formData) => uploadProductIcon(editingId, formData)}
          remove={() => removeProductIcon(editingId)}
          label={tForm("imageLabel")}
          hint={tForm("imageHint")}
          uploadCta={tForm("imageUpload")}
          replaceCta={tForm("imageReplace")}
          removeCta={tForm("imageRemove")}
        />
      )}

      <div data-tour="product-icon">
        <span className="text-sm font-medium">Icon override</span>
        <p className="mt-0.5 text-xs text-zinc-500">
          Leave empty to use the category icon.
        </p>
        <div className="mt-1">
          <IconPicker
            value={iconKey}
            onChange={setIconKey}
            allowClear
            clearLabel="Use category icon"
          />
        </div>
        <details className="mt-2 text-xs text-zinc-600">
          <summary className="cursor-pointer">Emoji fallback (optional)</summary>
          <div className="mt-2 flex items-center gap-2">
            <input
              type="text"
              value={iconEmoji}
              onChange={(e) => setIconEmoji(e.target.value)}
              placeholder={selectedCategory?.iconEmoji ?? "📦"}
              maxLength={10}
              className="block w-20 rounded-lg border border-zinc-300 px-2 py-1 text-center text-xl"
              aria-label="Emoji fallback"
            />
            <span className="text-zinc-500">
              Shown if a device can&apos;t render the icon above.
            </span>
          </div>
        </details>
      </div>

      <div className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm">
        <span className="text-zinc-600">POS preview:</span>
        {EffectiveIcon ? (
          <EffectiveIcon
            className="h-7 w-7 text-zinc-800"
            strokeWidth={1.5}
          />
        ) : (
          <span className="text-2xl">{effectiveEmoji}</span>
        )}
        <span className="text-zinc-800">{initial.name || "(name)"}</span>
      </div>

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

      <fieldset
        data-tour="product-sellable"
        className="rounded-lg border border-zinc-200 px-4 py-3"
      >
        <legend className="px-1 text-sm font-medium">How you sell this</legend>
        <p className="px-1 text-xs text-zinc-500">Tick at least one.</p>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:gap-6">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="sellableAsUnit"
              defaultChecked={initial.sellableAsUnit}
              className="h-4 w-4 rounded border-zinc-300"
            />
            Sell singles
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="sellableAsCarton"
              defaultChecked={initial.sellableAsCarton}
              className="h-4 w-4 rounded border-zinc-300"
            />
            Sell whole cartons
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
