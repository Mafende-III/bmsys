"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { Product } from "@prisma/client";
import {
  Box,
  ClipboardList,
  ImageIcon,
  Minus,
  Package,
  Plus,
  Settings2,
  Tag,
} from "lucide-react";
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

/**
 * Turn a free-text product name into a SKU that satisfies the
 * server-side validator: starts with a letter or digit, only
 * uppercase A-Z 0-9 and the three symbols . _ -. Multiple disallowed
 * characters collapse to a single dash; leading/trailing dashes are
 * trimmed; max 50 chars.
 */
function skuify(name: string): string {
  return name
    .toUpperCase()
    .replace(/[^A-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-._]+|[-._]+$/g, "")
    .slice(0, 50);
}

// ── Shared field styles (module scope so inputs keep focus) ─────────
const CAPTION =
  "block text-[11px] font-semibold uppercase tracking-wide text-zinc-500";
const BIG_TEXT =
  "mt-1 block w-full rounded-xl border-2 border-zinc-200 bg-white px-3 py-3 text-base focus:border-zinc-900 focus:outline-none";
const BIG_MONEY =
  "block w-full rounded-xl border-2 border-zinc-200 bg-white py-3 pl-3 pr-12 text-right font-mono text-lg tabular-nums focus:border-zinc-900 focus:outline-none";

function MoneyField({
  label,
  name,
  value,
  onChange,
}: {
  label: string;
  name: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="block">
      <span className={CAPTION}>{label}</span>
      <div className="relative mt-1">
        <input
          type="number"
          name={name}
          required
          min={0}
          step={1}
          value={value || ""}
          placeholder="0"
          onChange={(e) => onChange(Number(e.target.value || 0))}
          className={BIG_MONEY}
        />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[11px] font-semibold text-zinc-400">
          RWF
        </span>
      </div>
    </label>
  );
}

function ToggleCard({
  name,
  defaultChecked,
  Icon,
  label,
  hint,
}: {
  name: string;
  defaultChecked: boolean;
  Icon: typeof Package;
  label: string;
  hint: string;
}) {
  return (
    <label className="flex-1 cursor-pointer">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="peer sr-only"
      />
      <div className="flex items-center gap-3 rounded-xl border-2 border-zinc-200 bg-white px-3 py-3 transition peer-checked:border-zinc-900 peer-checked:bg-zinc-900 peer-checked:text-white">
        <Icon className="h-6 w-6 shrink-0" strokeWidth={1.5} />
        <div className="min-w-0">
          <p className="text-sm font-semibold">{label}</p>
          <p className="text-[11px] opacity-70">{hint}</p>
        </div>
      </div>
    </label>
  );
}

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
  minMarginBps: number;
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
      minMarginBps: mode.product.minMarginBps,
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
    minMarginBps: 0,
    loyaltyPointsPerUnit: 0,
  };
}

type TabKey = "details" | "pricing" | "look" | "advanced";

/// Which tab each named input lives on — used to jump to the right
/// tab when the browser flags a hidden invalid field on submit.
const FIELD_TAB: Record<string, TabKey> = {
  sku: "details",
  name: "details",
  unitsPerCarton: "pricing",
  costPerCarton: "pricing",
  unitPrice: "pricing",
  cartonPrice: "pricing",
  sellableAsUnit: "pricing",
  sellableAsCarton: "pricing",
  lowStockThresholdUnits: "advanced",
  loyaltyPointsPerUnit: "advanced",
  minMarginPct: "advanced",
};

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

  const [tab, setTab] = useState<TabKey>("details");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [idempotencyKey, setIdempotencyKey] = useState(() =>
    crypto.randomUUID(),
  );

  // Live state
  const [name, setName] = useState(initial.name);
  const [sku, setSku] = useState(initial.sku);
  const [categoryId, setCategoryId] = useState(initial.categoryId);
  const [iconKey, setIconKey] = useState<string | null>(initial.iconKey);
  const [iconEmoji, setIconEmoji] = useState(initial.iconEmoji);
  const [unitsPerCarton, setUnitsPerCarton] = useState(initial.unitsPerCarton);
  const [costPerCarton, setCostPerCarton] = useState(initial.costPerCarton);
  const [unitPrice, setUnitPrice] = useState(initial.unitPrice);
  const [cartonPrice, setCartonPrice] = useState(initial.cartonPrice);

  // Auto-suggest the SKU from the name during create — stops once the
  // user edits the SKU field by hand. Edit mode never auto-fills (the
  // SKU is locked after creation anyway).
  const skuTouched = useRef(mode.kind === "edit");
  useEffect(() => {
    if (mode.kind === "create" && !skuTouched.current) {
      setSku(skuify(name));
    }
  }, [name, mode.kind]);

  const selectedCategory = categories.find((c) => c.id === categoryId);
  const effectiveIconKey = iconKey ?? selectedCategory?.iconKey ?? null;
  const EffectiveIcon = effectiveIconKey ? iconForKey(effectiveIconKey) : null;
  const effectiveEmoji = iconEmoji || selectedCategory?.iconEmoji || "📦";

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

  function marginTone(margin: number, pct: number): string {
    if (costPerCarton <= 0) return "bg-zinc-100 text-zinc-500";
    if (margin < 0) return "bg-red-100 text-red-700";
    if (pct < 5) return "bg-amber-100 text-amber-800";
    return "bg-green-100 text-green-800";
  }

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
      // % → basis points (10000 = 100%). Round to whole bps.
      minMarginBps: Math.round(
        Number(formData.get("minMarginPct") ?? 0) * 100,
      ),
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

  const tabs: Array<{ key: TabKey; label: string; Icon: typeof Tag }> = [
    { key: "details", label: "Details", Icon: ClipboardList },
    { key: "pricing", label: "Pricing", Icon: Tag },
    { key: "look", label: "Look", Icon: ImageIcon },
    { key: "advanced", label: "Advanced", Icon: Settings2 },
  ];

  const panel = (key: TabKey) => (tab === key ? "space-y-4" : "hidden");

  return (
    <form
      action={handleSubmit}
      className="space-y-4"
      onInvalidCapture={(e) => {
        // A required field inside a hidden tab can't be focused by the
        // browser — jump to its tab so the native message can show.
        const nm = (e.target as HTMLInputElement).name;
        const target = FIELD_TAB[nm];
        if (target && target !== tab) setTab(target);
      }}
    >
      {error && (
        <div className="rounded-xl border-2 border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Tab bar */}
      <div
        data-tour="product-tabs"
        className="grid grid-cols-4 gap-1 rounded-xl bg-zinc-100 p-1"
      >
        {tabs.map(({ key, label, Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            aria-selected={tab === key}
            className={`flex flex-col items-center gap-0.5 rounded-lg px-2 py-2 text-xs font-semibold transition sm:flex-row sm:justify-center sm:gap-1.5 ${
              tab === key
                ? "bg-zinc-900 text-white shadow-sm"
                : "text-zinc-500 hover:text-zinc-800"
            }`}
          >
            <Icon className="h-4 w-4" strokeWidth={2} />
            {label}
          </button>
        ))}
      </div>

      {/* ── Details ─────────────────────────────────────────────────── */}
      <div className={panel("details")}>
        <label className="block">
          <span className={CAPTION}>Name</span>
          <input
            type="text"
            name="name"
            required
            autoFocus={mode.kind === "create"}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Inyange Water 500ML"
            className={BIG_TEXT}
          />
        </label>

        <label className="block" data-tour="product-sku">
          <span className={CAPTION}>Product code</span>
          {mode.kind === "edit" ? (
            <input
              value={mode.product.sku}
              disabled
              className="mt-1 block w-full rounded-xl border-2 border-zinc-200 bg-zinc-50 px-3 py-3 font-mono text-sm text-zinc-500"
            />
          ) : (
            <input
              type="text"
              name="sku"
              required
              value={sku}
              onChange={(e) => {
                skuTouched.current = true;
                setSku(e.target.value);
              }}
              placeholder="Auto-filled from the name"
              className="mt-1 block w-full rounded-xl border-2 border-zinc-200 bg-white px-3 py-3 font-mono text-sm uppercase tracking-wide focus:border-zinc-900 focus:outline-none"
            />
          )}
          <span className="mt-1 block text-xs text-zinc-500">
            {mode.kind === "create"
              ? "Fills itself from the name — change it only if you want. Locked after creation."
              : "Locked after creation."}
          </span>
        </label>

        <label className="block">
          <span className={CAPTION}>Category</span>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="mt-1 block w-full rounded-xl border-2 border-zinc-200 bg-white px-3 py-3 text-base focus:border-zinc-900 focus:outline-none"
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
      </div>

      {/* ── Pricing ─────────────────────────────────────────────────── */}
      <div className={panel("pricing")}>
        {/* Units per carton — stepper */}
        <div>
          <span className={CAPTION}>Units per carton</span>
          <div className="mt-1 flex items-center gap-2">
            <button
              type="button"
              aria-label="Fewer units per carton"
              onClick={() => setUnitsPerCarton(Math.max(1, unitsPerCarton - 1))}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-2 border-zinc-200 bg-white text-zinc-700 active:scale-95"
            >
              <Minus className="h-5 w-5" strokeWidth={2} />
            </button>
            <input
              type="number"
              name="unitsPerCarton"
              required
              min={1}
              step={1}
              value={unitsPerCarton || ""}
              onChange={(e) =>
                setUnitsPerCarton(Math.max(0, Number(e.target.value || 0)))
              }
              className="block h-12 w-full rounded-xl border-2 border-zinc-200 bg-white text-center font-mono text-xl font-semibold tabular-nums focus:border-zinc-900 focus:outline-none"
            />
            <button
              type="button"
              aria-label="More units per carton"
              onClick={() => setUnitsPerCarton(unitsPerCarton + 1)}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-2 border-zinc-200 bg-white text-zinc-700 active:scale-95"
            >
              <Plus className="h-5 w-5" strokeWidth={2} />
            </button>
          </div>
          <span className="mt-1 block text-xs text-zinc-500">
            How many pieces come in one sealed carton. Use 1 for items sold
            alone (e.g. 18.9L bottles).
          </span>
        </div>

        <MoneyField
          label="You buy a carton at"
          name="costPerCarton"
          value={costPerCarton}
          onChange={setCostPerCarton}
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <MoneyField
            label="You sell a single at"
            name="unitPrice"
            value={unitPrice}
            onChange={setUnitPrice}
          />
          <MoneyField
            label="You sell a whole carton at"
            name="cartonPrice"
            value={cartonPrice}
            onChange={setCartonPrice}
          />
        </div>

        {/* Live margin chips */}
        {margins && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border-2 border-zinc-100 bg-zinc-50 px-3 py-2.5">
            <span className={CAPTION}>Profit</span>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-1 font-mono text-xs font-semibold tabular-nums ${marginTone(margins.unitMargin, margins.unitPct)}`}
            >
              single {margins.unitMargin >= 0 ? "+" : ""}
              {formatRWF(margins.unitMargin)} ({margins.unitPct >= 0 ? "+" : ""}
              {margins.unitPct}%)
            </span>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-1 font-mono text-xs font-semibold tabular-nums ${marginTone(margins.cartonMargin, margins.cartonPct)}`}
            >
              carton {margins.cartonMargin >= 0 ? "+" : ""}
              {formatRWF(margins.cartonMargin)} (
              {margins.cartonPct >= 0 ? "+" : ""}
              {margins.cartonPct}%)
            </span>
            <span className="ml-auto font-mono text-[11px] tabular-nums text-zinc-500">
              cost/piece {formatRWF(margins.costPerUnit)}
            </span>
          </div>
        )}

        {/* Sell-as tap cards */}
        <div data-tour="product-sellable">
          <span className={CAPTION}>How you sell it</span>
          <div className="mt-1 flex flex-col gap-2 sm:flex-row">
            <ToggleCard
              name="sellableAsUnit"
              defaultChecked={initial.sellableAsUnit}
              Icon={Box}
              label="Singles"
              hint="One piece at a time"
            />
            <ToggleCard
              name="sellableAsCarton"
              defaultChecked={initial.sellableAsCarton}
              Icon={Package}
              label="Whole cartons"
              hint="Sealed carton at once"
            />
          </div>
        </div>
      </div>

      {/* ── Look ────────────────────────────────────────────────────── */}
      <div className={panel("look")}>
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
        {!editingId && (
          <p className="rounded-xl border-2 border-zinc-100 bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
            You can upload a photo after the product is created.
          </p>
        )}

        <div data-tour="product-icon">
          <span className={CAPTION}>Icon override</span>
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
            <summary className="cursor-pointer">
              Emoji fallback (optional)
            </summary>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="text"
                value={iconEmoji}
                onChange={(e) => setIconEmoji(e.target.value)}
                placeholder={selectedCategory?.iconEmoji ?? "📦"}
                maxLength={10}
                className="block w-20 rounded-xl border-2 border-zinc-200 px-2 py-1 text-center text-xl"
                aria-label="Emoji fallback"
              />
              <span className="text-zinc-500">
                Shown if a device can&apos;t render the icon above.
              </span>
            </div>
          </details>
        </div>

        <div className="flex items-center gap-3 rounded-xl border-2 border-zinc-100 bg-zinc-50 px-3 py-2.5 text-sm">
          <span className={CAPTION}>POS preview</span>
          {EffectiveIcon ? (
            <EffectiveIcon className="h-7 w-7 text-zinc-800" strokeWidth={1.5} />
          ) : (
            <span className="text-2xl">{effectiveEmoji}</span>
          )}
          <span className="text-zinc-800">{name || "(name)"}</span>
        </div>
      </div>

      {/* ── Advanced ────────────────────────────────────────────────── */}
      <div className={panel("advanced")}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className={CAPTION}>Low-stock alert at (units)</span>
            <input
              type="number"
              name="lowStockThresholdUnits"
              min={0}
              step={1}
              defaultValue={initial.lowStockThresholdUnits}
              className={`${BIG_TEXT} font-mono tabular-nums`}
            />
          </label>
          <label className="block">
            <span className={CAPTION}>Loyalty points per unit</span>
            <input
              type="number"
              name="loyaltyPointsPerUnit"
              min={0}
              step={1}
              defaultValue={initial.loyaltyPointsPerUnit}
              className={`${BIG_TEXT} font-mono tabular-nums`}
            />
          </label>
          <label className="block sm:col-span-2">
            <span className={CAPTION}>Minimum profit margin (%)</span>
            <input
              type="number"
              name="minMarginPct"
              min={0}
              max={100}
              step="0.1"
              defaultValue={
                initial.minMarginBps > 0 ? initial.minMarginBps / 100 : ""
              }
              placeholder="e.g. 30"
              className={`${BIG_TEXT} font-mono tabular-nums`}
            />
            <span className="mt-1 block text-xs text-zinc-500">
              The floor for coupons and discounts — the price can never drop
              below cost + this margin. Blank uses the shop-wide default.
            </span>
          </label>
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <Link
          href="/products"
          className="flex-1 rounded-xl border-2 border-zinc-200 bg-white px-4 py-3 text-center text-sm font-semibold hover:bg-zinc-50"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={isPending}
          className="flex-1 rounded-xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60"
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
