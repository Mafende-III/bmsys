"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatRWF } from "@/lib/format";
import {
  cancelPurchase,
  receivePurchase,
  savePurchaseDraft,
} from "@/lib/purchases/actions";

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
        productId: products[0]?.id ?? "",
        qtyCartons: "1",
        unitCost: products[0] ? String(products[0].costPerCarton) : "0",
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
    const p = products.find((p) => p.id === productId);
    updateLine(i, {
      productId,
      unitCost: p ? String(p.costPerCarton) : "0",
    });
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
        setSavedNote("Saved.");
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
      setSavedNote(
        `Received. ${result.data.movesCreated} stock move${result.data.movesCreated === 1 ? "" : "s"} written.`,
      );
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
          ? "This will reverse the stock that was received. Continue?"
          : "Cancel this draft purchase?",
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
      setSavedNote(
        result.data.reversingMoves > 0
          ? `Cancelled. ${result.data.reversingMoves} reversing stock move${result.data.reversingMoves === 1 ? "" : "s"} written.`
          : "Cancelled.",
      );
      setCancelKey(crypto.randomUUID());
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {savedNote && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {savedNote}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium">Supplier</span>
          <select
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            disabled={readOnly}
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-50 disabled:text-zinc-500"
          >
            {suppliers.length === 0 && (
              <option value="">(no suppliers yet)</option>
            )}
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-medium">Date</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            disabled={readOnly}
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-50 disabled:text-zinc-500"
          />
        </label>
      </div>

      <label className="block">
        <span className="text-sm font-medium">Note (optional)</span>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          disabled={readOnly}
          placeholder="Reference number, delivery driver, etc."
          className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-50 disabled:text-zinc-500"
        />
      </label>

      <section className="rounded-2xl border border-zinc-200 bg-white p-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">Lines</h2>
          {!readOnly && (
            <button
              type="button"
              onClick={addLine}
              disabled={products.length === 0}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-1 text-xs font-medium hover:bg-zinc-50 disabled:opacity-50"
            >
              + Add line
            </button>
          )}
        </div>

        {lines.length === 0 ? (
          <p className="mt-3 text-xs text-zinc-500">No lines yet.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {lines.map((l, i) => {
              const product = products.find((p) => p.id === l.productId);
              const cartons = parsePositiveInt(l.qtyCartons);
              const unitCost = parsePositiveInt(l.unitCost);
              const lineTotal = cartons * unitCost;
              const units =
                cartons * (product?.unitsPerCarton ?? 0);
              return (
                <div
                  key={i}
                  className="rounded-lg border border-zinc-200 p-2"
                >
                  <div className="grid grid-cols-12 gap-2">
                    <select
                      value={l.productId}
                      onChange={(e) => onProductPick(i, e.target.value)}
                      disabled={readOnly}
                      className="col-span-12 rounded-lg border border-zinc-300 px-2 py-1.5 text-sm disabled:bg-zinc-50 sm:col-span-5"
                    >
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.sku})
                        </option>
                      ))}
                    </select>
                    <label className="col-span-4 sm:col-span-2">
                      <span className="text-[10px] uppercase text-zinc-500">
                        Cartons
                      </span>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={l.qtyCartons}
                        onChange={(e) =>
                          updateLine(i, { qtyCartons: e.target.value })
                        }
                        disabled={readOnly}
                        className="mt-0.5 block w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm disabled:bg-zinc-50"
                      />
                    </label>
                    <label className="col-span-4 sm:col-span-2">
                      <span className="text-[10px] uppercase text-zinc-500">
                        Cost/carton
                      </span>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={l.unitCost}
                        onChange={(e) =>
                          updateLine(i, { unitCost: e.target.value })
                        }
                        disabled={readOnly}
                        className="mt-0.5 block w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm disabled:bg-zinc-50"
                      />
                    </label>
                    <div className="col-span-4 flex items-end justify-between sm:col-span-3">
                      <div className="text-xs text-zinc-700">
                        <p className="text-[10px] uppercase text-zinc-500">
                          Total
                        </p>
                        <p className="font-mono tabular-nums">
                          {formatRWF(lineTotal)}
                        </p>
                      </div>
                      {!readOnly && (
                        <button
                          type="button"
                          onClick={() => removeLine(i)}
                          className="text-xs text-red-600 hover:underline"
                          aria-label="Remove line"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                  {product && cartons > 0 && (
                    <p className="mt-1 text-[10px] text-zinc-500">
                      = {units} units @ {product.unitsPerCarton}/carton
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-3 flex items-center justify-between border-t border-zinc-200 pt-2 text-sm">
          <span className="font-medium">Total</span>
          <span className="font-mono tabular-nums">{formatRWF(total)}</span>
        </div>
      </section>

      <div className="flex flex-wrap gap-2 pt-2">
        <Link
          href="/purchases"
          className="flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-center text-sm font-medium hover:bg-zinc-50"
        >
          Back to list
        </Link>
        {!readOnly && (
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium hover:bg-zinc-50 disabled:opacity-60"
          >
            {isPending
              ? "Saving..."
              : mode.kind === "create"
                ? "Save draft"
                : "Save changes"}
          </button>
        )}
        {mode.kind === "edit" && mode.status === "DRAFT" && (
          <button
            type="button"
            onClick={handleReceive}
            disabled={isPending || lines.length === 0}
            className="flex-1 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
          >
            {isPending ? "Working..." : "Receive"}
          </button>
        )}
        {mode.kind === "edit" && mode.status !== "CANCELLED" && (
          <button
            type="button"
            onClick={handleCancel}
            disabled={isPending}
            className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-60"
          >
            Cancel purchase
          </button>
        )}
      </div>
    </div>
  );
}
