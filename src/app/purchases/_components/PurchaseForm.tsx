"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Download, Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { CaptionLabel, Card, MoneyField } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatRWF } from "@/lib/format";
import {
  cancelPurchase,
  receivePurchase,
  savePurchaseDraft,
} from "@/lib/purchases/actions";
import {
  QuickCreateProductSheet,
  type CreatedProduct,
} from "./QuickCreateProductSheet";

type ProductOption = {
  id: string;
  sku: string;
  name: string;
  unitsPerCarton: number;
  costPerCarton: number;
};

type SupplierOption = { id: string; name: string };

type LineState = {
  productId: string;
  qtyCartons: string; // input value as string
  unitCost: string;
};

type Mode =
  | { kind: "create" }
  | {
      kind: "edit";
      id: string;
      status: "DRAFT" | "RECEIVED" | "CANCELLED";
      supplierId: string;
      date: Date;
      note: string;
      lines: Array<{
        productId: string;
        qtyCartons: number;
        unitCost: number;
      }>;
    };

function toDateInput(d: Date): string {
  // Local YYYY-MM-DD for <input type="date">
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parsePositiveInt(v: string): number {
  const n = Number(v.trim());
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

const FIELD =
  "mt-1.5 block h-11 w-full rounded-panel border border-rule bg-surface px-3 text-sm text-ink focus:border-rule-active focus:outline-none focus:ring-1 focus:ring-rule-active disabled:bg-ground disabled:text-ink-2";

export function PurchaseForm({
  mode,
  suppliers,
  products,
}: {
  mode: Mode;
  suppliers: SupplierOption[];
  products: ProductOption[];
}) {
  const router = useRouter();
  const t = useTranslations("purchases.form");
  const readOnly = mode.kind === "edit" && mode.status !== "DRAFT";

  const initial =
    mode.kind === "edit"
      ? {
          supplierId: mode.supplierId,
          date: toDateInput(mode.date),
          note: mode.note,
          lines: mode.lines.map((l) => ({
            productId: l.productId,
            qtyCartons: String(l.qtyCartons),
            unitCost: String(l.unitCost),
          })) as LineState[],
        }
      : {
          supplierId: suppliers[0]?.id ?? "",
          date: toDateInput(new Date()),
          note: "",
          lines: [] as LineState[],
        };

  const [supplierId, setSupplierId] = useState(initial.supplierId);
  const [date, setDate] = useState(initial.date);
  const [note, setNote] = useState(initial.note);
  const [lines, setLines] = useState<LineState[]>(initial.lines);
  // Products created inline land here so selects know them before
  // the server props refresh.
  const [productList, setProductList] = useState<ProductOption[]>(products);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const [sheetOpen, setSheetOpen] = useState(false);
  const [createdNote, setCreatedNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [saveKey, setSaveKey] = useState(() => crypto.randomUUID());
  const [receiveKey, setReceiveKey] = useState(() => crypto.randomUUID());
  const [cancelKey, setCancelKey] = useState(() => crypto.randomUUID());

  function addLine() {
    setLines((prev) => [
      ...prev,
      {
        productId: productList[0]?.id ?? "",
        qtyCartons: "1",
        unitCost: productList[0] ? String(productList[0].costPerCarton) : "0",
      },
    ]);
  }

  function updateLine(i: number, patch: Partial<LineState>) {
    setLines((prev) =>
      prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)),
    );
  }

  function removeLine(i: number) {
    setLines((prev) => prev.filter((_, idx) => idx !== i));
  }

  function onProductPick(i: number, productId: string) {
    const p = productList.find((p) => p.id === productId);
    updateLine(i, {
      productId,
      unitCost: p ? String(p.costPerCarton) : "0",
    });
  }

  function onCreated(p: CreatedProduct) {
    setProductList((prev) => [...prev, p]);
    setNewIds((prev) => new Set(prev).add(p.id));
    setLines((prev) => [
      ...prev,
      {
        productId: p.id,
        qtyCartons: "1",
        unitCost: String(p.costPerCarton),
      },
    ]);
    setSheetOpen(false);
    setCreatedNote(t("qcCreated", { name: p.name }));
    router.refresh();
  }

  const total = useMemo(() => {
    return lines.reduce((sum, l) => {
      const c = parsePositiveInt(l.qtyCartons);
      const u = parsePositiveInt(l.unitCost);
      return sum + c * u;
    }, 0);
  }, [lines]);

  function buildPayload() {
    return {
      supplierId,
      date,
      note,
      lines: lines.map((l) => ({
        productId: l.productId,
        qtyCartons: parsePositiveInt(l.qtyCartons),
        qtyLooseUnits: 0,
        unitCost: parsePositiveInt(l.unitCost),
      })),
    };
  }

  function handleSave() {
    setError(null);
    setSavedNote(null);
    startTransition(async () => {
      const id = mode.kind === "edit" ? mode.id : null;
      const result = await savePurchaseDraft(saveKey, id, buildPayload());
      if (!result.ok) {
        setError(result.error);
        setSaveKey(crypto.randomUUID());
        return;
      }
      if (mode.kind === "create") {
        router.push(`/purchases/${result.data.id}`);
      } else {
        setSavedNote(t("saved"));
        setSaveKey(crypto.randomUUID());
        router.refresh();
      }
    });
  }

  function handleReceive() {
    if (mode.kind !== "edit") return;
    setError(null);
    setSavedNote(null);
    startTransition(async () => {
      // Save first so the lines on disk match what's in the form
      const saveResult = await savePurchaseDraft(
        saveKey,
        mode.id,
        buildPayload(),
      );
      if (!saveResult.ok) {
        setError(saveResult.error);
        setSaveKey(crypto.randomUUID());
        return;
      }
      const result = await receivePurchase(receiveKey, mode.id);
      if (!result.ok) {
        setError(result.error);
        setReceiveKey(crypto.randomUUID());
        return;
      }
      setSavedNote(t("receivedNote"));
      setReceiveKey(crypto.randomUUID());
      setSaveKey(crypto.randomUUID());
      router.refresh();
    });
  }

  function handleCancel() {
    if (mode.kind !== "edit") return;
    if (
      !confirm(
        mode.status === "RECEIVED"
          ? t("confirmCancelReceived")
          : t("confirmCancelDraft"),
      )
    )
      return;
    setError(null);
    setSavedNote(null);
    startTransition(async () => {
      const result = await cancelPurchase(cancelKey, mode.id);
      if (!result.ok) {
        setError(result.error);
        setCancelKey(crypto.randomUUID());
        return;
      }
      setSavedNote(t("cancelledNote"));
      setCancelKey(crypto.randomUUID());
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-panel bg-error-wash px-3.5 py-2.5 text-sm font-semibold text-error">
          {error}
        </div>
      )}
      {savedNote && (
        <div className="flex items-center gap-2 rounded-panel bg-success-wash px-3.5 py-2.5 text-sm font-semibold text-success">
          <Check className="h-4 w-4 shrink-0" strokeWidth={2.6} />
          {savedNote}
        </div>
      )}
      {createdNote && (
        <div className="flex items-center gap-2 rounded-panel bg-success-wash px-3.5 py-2.5 text-sm font-semibold text-success">
          <Check className="h-4 w-4 shrink-0" strokeWidth={2.6} />
          {createdNote}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <CaptionLabel>{t("supplier")}</CaptionLabel>
          <select
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            disabled={readOnly}
            className={FIELD}
          >
            {suppliers.length === 0 && <option value="">—</option>}
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <CaptionLabel>{t("date")}</CaptionLabel>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            disabled={readOnly}
            className={FIELD}
          />
        </label>
      </div>

      <label className="block">
        <CaptionLabel>{t("noteOptional")}</CaptionLabel>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          disabled={readOnly}
          placeholder={t("notePlaceholder")}
          className={FIELD}
        />
      </label>

      <section>
        <CaptionLabel className="mb-2 px-0.5">{t("lines")}</CaptionLabel>

        {lines.length === 0 ? (
          <p className="rounded-panel bg-ground px-3.5 py-3 text-[13px] text-ink-2">
            {t("noLines")}
          </p>
        ) : (
          <div className="space-y-2.5">
            {lines.map((l, i) => {
              const product = productList.find((p) => p.id === l.productId);
              const cartons = parsePositiveInt(l.qtyCartons);
              const unitCost = parsePositiveInt(l.unitCost);
              const lineTotal = cartons * unitCost;
              const units = cartons * (product?.unitsPerCarton ?? 0);
              return (
                <Card key={i} className="p-3">
                  <div className="flex gap-2">
                    <select
                      value={l.productId}
                      onChange={(e) => onProductPick(i, e.target.value)}
                      disabled={readOnly}
                      className={cn(FIELD, "mt-0 flex-1 font-semibold")}
                    >
                      {productList.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.sku})
                        </option>
                      ))}
                    </select>
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={() => removeLine(i)}
                        aria-label={t("remove")}
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-panel bg-ground text-ink-2"
                      >
                        <X className="h-4 w-4" strokeWidth={2.2} />
                      </button>
                    )}
                  </div>
                  <div className="mt-2.5 grid grid-cols-3 gap-2.5">
                    <label className="block">
                      <CaptionLabel>{t("cartons")}</CaptionLabel>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        inputMode="numeric"
                        value={l.qtyCartons}
                        onChange={(e) =>
                          updateLine(i, { qtyCartons: e.target.value })
                        }
                        disabled={readOnly}
                        className={cn(
                          FIELD,
                          "num text-right text-base font-semibold",
                        )}
                      />
                    </label>
                    <MoneyField
                      label={t("costPerCarton")}
                      value={l.unitCost}
                      onChange={(e) =>
                        updateLine(i, { unitCost: e.target.value })
                      }
                      disabled={readOnly}
                      inputClassName="mt-1.5"
                    />
                    <div>
                      <CaptionLabel>{t("lineTotal")}</CaptionLabel>
                      <p className="num mt-1.5 flex h-11 items-center justify-end text-base font-bold text-ink">
                        {formatRWF(lineTotal)}
                      </p>
                    </div>
                  </div>
                  {product && cartons > 0 && (
                    <p className="mt-1.5 flex items-center gap-2 text-[11px] text-ink-2">
                      {newIds.has(l.productId) && (
                        <span className="rounded-full bg-success-wash px-2 py-0.5 text-[10px] font-bold tracking-wide text-success">
                          NEW
                        </span>
                      )}
                      {t("unitsHint", {
                        units,
                        per: product.unitsPerCarton,
                      })}
                    </p>
                  )}
                </Card>
              );
            })}
          </div>
        )}

        {!readOnly && (
          <div className="mt-2.5 flex gap-2.5">
            <button
              type="button"
              onClick={addLine}
              disabled={productList.length === 0}
              className="flex h-12 flex-1 items-center justify-center gap-2 rounded-[14px] bg-keycap text-sm font-bold text-ink shadow-keycap active:bg-none active:bg-well active:shadow-well disabled:opacity-50"
            >
              <Plus className="h-4 w-4" strokeWidth={2.6} />
              {t("addLine")}
            </button>
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              data-tour="purchase-quick-create"
              className="flex h-12 flex-1 items-center justify-center gap-2 rounded-[14px] border-[1.5px] border-dashed border-primary bg-surface-sunk text-sm font-bold text-primary active:translate-y-[1px]"
            >
              <Plus className="h-4 w-4" strokeWidth={2.6} />
              {t("newProduct")}
            </button>
          </div>
        )}

        <div className="mt-3 flex items-baseline justify-between border-t border-rule-hair px-0.5 pt-3">
          <CaptionLabel>{t("total")}</CaptionLabel>
          <span className="num text-xl font-bold text-ink">
            {formatRWF(total)}
          </span>
        </div>
      </section>

      <div className="flex flex-wrap gap-2.5 pt-1">
        <Link
          href="/purchases"
          className="flex h-12 items-center rounded-full bg-surface px-5 text-sm font-semibold text-ink-2 ring-1 ring-inset ring-rule"
        >
          {t("back")}
        </Link>
        {!readOnly && (
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="h-12 flex-1 rounded-full bg-surface text-sm font-bold text-ink ring-1 ring-inset ring-rule disabled:opacity-60"
          >
            {isPending
              ? t("saving")
              : mode.kind === "create"
                ? t("saveDraft")
                : t("saveChanges")}
          </button>
        )}
        {mode.kind === "edit" && mode.status === "DRAFT" && (
          <button
            type="button"
            onClick={handleReceive}
            disabled={isPending || lines.length === 0}
            data-tour="purchase-receive"
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-fab text-sm font-bold text-white shadow-fab active:translate-y-[2px] disabled:opacity-60"
          >
            <Download className="h-4 w-4" strokeWidth={2.4} />
            {isPending ? t("working") : t("receiveAll")}
          </button>
        )}
        {mode.kind === "edit" && mode.status !== "CANCELLED" && (
          <button
            type="button"
            onClick={handleCancel}
            disabled={isPending}
            className="h-12 rounded-full bg-surface px-5 text-sm font-bold text-error ring-1 ring-inset ring-rule disabled:opacity-60"
          >
            {t("cancelPurchase")}
          </button>
        )}
      </div>

      <QuickCreateProductSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onCreated={onCreated}
      />
    </div>
  );
}
