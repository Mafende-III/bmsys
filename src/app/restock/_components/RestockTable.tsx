"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileInput, RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import { formatRWF } from "@/lib/format";
import { savePurchaseDraft } from "@/lib/purchases/actions";
import type { RestockRow } from "@/lib/restock/queries";

type Draft = {
  cartonsRaw: string;
  costRaw: string;
};

export type SupplierOption = { id: string; name: string };

/**
 * Editable order sheet. The server's suggestion seeds each row; the
 * owner tweaks cartons and cost-per-carton to match supplier reality
 * and the totals recompute live. Nothing is persisted — the final
 * numbers go into the existing purchase flow when the stock arrives.
 */
export function RestockTable({
  rows,
  suppliers,
}: {
  rows: RestockRow[];
  suppliers: SupplierOption[];
}) {
  const t = useTranslations("restock");
  const router = useRouter();
  const [supplierId, setSupplierId] = useState("");
  const [draftError, setDraftError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [drafts, setDrafts] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(
      rows.map((r) => [
        r.productId,
        {
          cartonsRaw: r.suggestedCartons > 0 ? String(r.suggestedCartons) : "",
          costRaw: String(r.costPerCarton),
        },
      ]),
    ),
  );

  function setDraft(productId: string, patch: Partial<Draft>) {
    setDrafts((d) => ({
      ...d,
      [productId]: { ...d[productId]!, ...patch },
    }));
  }

  function resetAll() {
    setDrafts(
      Object.fromEntries(
        rows.map((r) => [
          r.productId,
          {
            cartonsRaw:
              r.suggestedCartons > 0 ? String(r.suggestedCartons) : "",
            costRaw: String(r.costPerCarton),
          },
        ]),
      ),
    );
  }

  function lineNumbers(r: RestockRow): {
    cartons: number;
    cost: number;
    lineTotal: number;
  } {
    const d = drafts[r.productId];
    const cartons = Math.max(0, Math.floor(Number(d?.cartonsRaw || 0)) || 0);
    const cost = Math.max(0, Math.floor(Number(d?.costRaw || 0)) || 0);
    return { cartons, cost, lineTotal: cartons * cost };
  }

  const totals = useMemo(() => {
    let products = 0;
    let cost = 0;
    for (const r of rows) {
      const n = lineNumbers(r);
      if (n.cartons > 0) {
        products += 1;
        cost += n.lineTotal;
      }
    }
    return { products, cost };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, drafts]);

  function createDraft() {
    setDraftError(null);
    const lines = rows
      .map((r) => {
        const n = lineNumbers(r);
        return {
          productId: r.productId,
          qtyCartons: n.cartons,
          qtyLooseUnits: 0,
          unitCost: n.cost,
        };
      })
      .filter((l) => l.qtyCartons > 0);
    if (lines.length === 0) {
      setDraftError(t("draftErrorNoLines"));
      return;
    }
    if (!supplierId) {
      setDraftError(t("draftErrorNoSupplier"));
      return;
    }
    startTransition(async () => {
      const result = await savePurchaseDraft(crypto.randomUUID(), null, {
        supplierId,
        date: new Date(),
        note: t("draftNote"),
        lines,
      });
      if (!result.ok) {
        setDraftError(result.error);
        return;
      }
      router.push(`/purchases/${result.data.id}`);
    });
  }

  return (
    <>
      {/* Order summary (live) */}
      <section
        data-tour="restock-summary"
        className="grid grid-cols-3 gap-2 rounded-2xl border border-zinc-200 bg-white p-3 text-xs"
      >
        <div>
          <p className="text-[10px] uppercase tracking-wide text-zinc-500">
            {t("statUrgent")}
          </p>
          <p
            className={`mt-0.5 font-mono text-lg font-semibold tabular-nums ${
              rows.some(
                (r) => r.urgency === "OUT" || r.urgency === "CRITICAL",
              )
                ? "text-red-700"
                : "text-green-700"
            }`}
          >
            {
              rows.filter(
                (r) => r.urgency === "OUT" || r.urgency === "CRITICAL",
              ).length
            }
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-zinc-500">
            {t("statToOrder")}
          </p>
          <p className="mt-0.5 font-mono text-lg font-semibold tabular-nums">
            {totals.products}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-zinc-500">
            {t("statOrderCost")}
          </p>
          <p className="mt-0.5 font-mono text-lg font-semibold tabular-nums">
            {formatRWF(totals.cost)}
          </p>
        </div>
      </section>

      {/* Plan table */}
      <section
        data-tour="restock-table"
        className="overflow-hidden rounded-2xl border border-zinc-200 bg-white"
      >
        <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-2">
          <p className="text-xs text-zinc-500">{t("editHint")}</p>
          <button
            type="button"
            onClick={resetAll}
            className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
          >
            <RotateCcw className="h-3.5 w-3.5" strokeWidth={2} />
            {t("resetSuggestions")}
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-xs text-zinc-600">
              <tr>
                <th className="px-4 py-2 text-left font-medium">
                  {t("colProduct")}
                </th>
                <th className="px-3 py-2 text-right font-medium">
                  {t("colStock")}
                </th>
                <th className="px-3 py-2 text-right font-medium">
                  {t("colBurn")}
                </th>
                <th className="px-3 py-2 text-right font-medium">
                  {t("colDaysLeft")}
                </th>
                <th className="px-3 py-2 text-right font-medium">
                  {t("colOrderCartons")}
                </th>
                <th className="px-3 py-2 text-right font-medium">
                  {t("colCostPerCarton")}
                </th>
                <th className="px-4 py-2 text-right font-medium">
                  {t("colLineCost")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {rows.map((r) => {
                const d = drafts[r.productId]!;
                const n = lineNumbers(r);
                const badge =
                  r.urgency === "OUT"
                    ? { label: t("badgeOut"), cls: "bg-red-100 text-red-700" }
                    : r.urgency === "CRITICAL"
                      ? {
                          label: t("badgeDays", { count: r.daysToOut ?? 0 }),
                          cls: "bg-red-100 text-red-700",
                        }
                      : r.urgency === "LOW"
                        ? {
                            label: t("badgeDays", { count: r.daysToOut ?? 0 }),
                            cls: "bg-amber-100 text-amber-800",
                          }
                        : {
                            label:
                              r.daysToOut == null
                                ? t("badgeNoSales")
                                : t("badgeDays", { count: r.daysToOut }),
                            cls: "bg-zinc-100 text-zinc-600",
                          };
                const edited =
                  n.cartons !==
                    (r.suggestedCartons > 0 ? r.suggestedCartons : 0) ||
                  n.cost !== r.costPerCarton;
                return (
                  <tr key={r.productId}>
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-zinc-800">
                        {r.name}
                        {edited && (
                          <span className="ml-1.5 align-middle text-[10px] font-normal text-blue-700">
                            {t("editedBadge")}
                          </span>
                        )}
                      </p>
                      <p className="font-mono text-[10px] text-zinc-500">
                        {r.sku}
                        {r.unitsPerCarton > 1
                          ? ` · ${r.unitsPerCarton}/carton`
                          : ""}
                      </p>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums text-zinc-700">
                      {r.stockUnits}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums text-zinc-500">
                      {r.dailyBurn.toFixed(1)}/d
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <span
                        className={`inline-block rounded-md px-1.5 py-0.5 font-mono text-xs tabular-nums ${badge.cls}`}
                      >
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        step={1}
                        value={d.cartonsRaw}
                        onChange={(e) =>
                          setDraft(r.productId, { cartonsRaw: e.target.value })
                        }
                        placeholder="0"
                        className="h-9 w-16 rounded-lg border border-zinc-300 bg-white px-2 text-right font-mono text-sm tabular-nums"
                      />
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        step={50}
                        value={d.costRaw}
                        onChange={(e) =>
                          setDraft(r.productId, { costRaw: e.target.value })
                        }
                        className="h-9 w-24 rounded-lg border border-zinc-300 bg-white px-2 text-right font-mono text-sm tabular-nums"
                      />
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono font-semibold tabular-nums text-zinc-900">
                      {n.lineTotal > 0 ? formatRWF(n.lineTotal) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {totals.cost > 0 && (
              <tfoot className="border-t-2 border-zinc-200 bg-zinc-50">
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-2.5 text-right text-sm font-medium"
                  >
                    {t("totalOrderCost")}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-base font-semibold tabular-nums">
                    {formatRWF(totals.cost)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>

      {/* Send to purchase draft */}
      <section
        data-tour="restock-draft"
        className="rounded-2xl border border-zinc-200 bg-white p-3"
      >
        {draftError && (
          <p className="mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {draftError}
          </p>
        )}
        <div className="flex flex-wrap items-end gap-2">
          <label className="block flex-1 text-xs">
            <span className="text-zinc-600">{t("draftSupplier")}</span>
            <select
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className="mt-0.5 block w-full rounded-lg border border-zinc-300 px-2 py-2 text-sm"
            >
              <option value="">{t("draftPickSupplier")}</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={createDraft}
            disabled={isPending || totals.products === 0}
            className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            <FileInput className="h-4 w-4" strokeWidth={2} />
            {isPending ? t("draftCreating") : t("draftCreate")}
          </button>
        </div>
        <p className="mt-2 text-[11px] text-zinc-500">{t("draftHint")}</p>
      </section>
    </>
  );
}
