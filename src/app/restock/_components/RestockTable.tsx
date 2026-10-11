"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, Clock, FileInput, RotateCcw, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Card, CaptionLabel, StatusPill, type StatusTone } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatRWF } from "@/lib/format";
import { savePurchaseDraft } from "@/lib/purchases/actions";
import type { RestockRow } from "@/lib/restock/queries";

type Draft = {
  cartonsRaw: string;
  costRaw: string;
};

export type SupplierOption = { id: string; name: string };

const CELL_FIELD =
  "num rounded-panel border border-rule bg-surface px-2 text-right text-sm font-semibold text-ink focus:border-rule-active focus:outline-none focus:ring-1 focus:ring-rule-active";

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

  function urgencyPill(r: RestockRow) {
    let tone: StatusTone;
    let icon: React.ReactNode;
    let label: string;
    if (r.urgency === "OUT") {
      tone = "error";
      icon = <X className="h-3 w-3" strokeWidth={3} />;
      label = t("badgeOut");
    } else if (r.urgency === "CRITICAL") {
      tone = "error";
      icon = <AlertTriangle className="h-3 w-3" strokeWidth={2.6} />;
      label = t("badgeDays", { count: r.daysToOut ?? 0 });
    } else if (r.urgency === "LOW") {
      tone = "warning";
      icon = <Clock className="h-3 w-3" strokeWidth={2.6} />;
      label = t("badgeDays", { count: r.daysToOut ?? 0 });
    } else {
      tone = "neutral";
      icon = <Check className="h-3 w-3" strokeWidth={3} />;
      label =
        r.daysToOut == null
          ? t("badgeNoSales")
          : t("badgeDays", { count: r.daysToOut });
    }
    return (
      <StatusPill tone={tone} icon={icon} className="num">
        {label}
      </StatusPill>
    );
  }

  const urgentCount = rows.filter(
    (r) => r.urgency === "OUT" || r.urgency === "CRITICAL",
  ).length;

  return (
    <>
      {/* Order summary (live) */}
      <section
        data-tour="restock-summary"
        className="grid grid-cols-3 gap-2.5"
      >
        <Card className="p-3">
          <CaptionLabel>{t("statUrgent")}</CaptionLabel>
          <p
            className={cn(
              "num mt-0.5 text-lg font-bold",
              urgentCount > 0 ? "text-error" : "text-success",
            )}
          >
            {urgentCount}
          </p>
        </Card>
        <Card className="p-3">
          <CaptionLabel>{t("statToOrder")}</CaptionLabel>
          <p className="num mt-0.5 text-lg font-bold text-ink">
            {totals.products}
          </p>
        </Card>
        <Card className="p-3">
          <CaptionLabel>{t("statOrderCost")}</CaptionLabel>
          <p className="num mt-0.5 text-lg font-bold text-ink">
            {formatRWF(totals.cost)}
          </p>
        </Card>
      </section>

      {/* Plan table */}
      <Card data-tour="restock-table" className="overflow-hidden">
        <div className="flex items-center justify-between gap-2 border-b border-rule-hair px-4 py-2.5">
          <p className="text-xs text-ink-2">{t("editHint")}</p>
          <button
            type="button"
            onClick={resetAll}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-surface px-3 text-xs font-bold text-primary ring-1 ring-inset ring-rule"
          >
            <RotateCcw className="h-3.5 w-3.5" strokeWidth={2.2} />
            {t("resetSuggestions")}
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-ground text-[11px] uppercase tracking-wide text-ink-2">
              <tr>
                <th className="px-4 py-2 text-left font-semibold">
                  {t("colProduct")}
                </th>
                <th className="px-3 py-2 text-right font-semibold">
                  {t("colStock")}
                </th>
                <th className="px-3 py-2 text-right font-semibold">
                  {t("colBurn")}
                </th>
                <th className="px-3 py-2 text-right font-semibold">
                  {t("colDaysLeft")}
                </th>
                <th className="px-3 py-2 text-right font-semibold">
                  {t("colOrderCartons")}
                </th>
                <th className="px-3 py-2 text-right font-semibold">
                  {t("colCostPerCarton")}
                </th>
                <th className="px-4 py-2 text-right font-semibold">
                  {t("colLineCost")}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const d = drafts[r.productId]!;
                const n = lineNumbers(r);
                const edited =
                  n.cartons !==
                    (r.suggestedCartons > 0 ? r.suggestedCartons : 0) ||
                  n.cost !== r.costPerCarton;
                return (
                  <tr
                    key={r.productId}
                    className={cn(i > 0 && "border-t border-rule-hair")}
                  >
                    <td className="px-4 py-2.5">
                      <p className="font-bold text-ink">
                        {r.name}
                        {edited && (
                          <span className="ml-1.5 align-middle text-[10px] font-bold text-primary">
                            {t("editedBadge")}
                          </span>
                        )}
                      </p>
                      <p className="num text-[10px] text-ink-2">
                        {r.sku}
                        {r.unitsPerCarton > 1
                          ? ` · ${r.unitsPerCarton}/carton`
                          : ""}
                      </p>
                    </td>
                    <td className="num px-3 py-2.5 text-right text-ink-2">
                      {r.stockUnits}
                    </td>
                    <td className="num px-3 py-2.5 text-right text-ink-2">
                      {r.dailyBurn.toFixed(1)}/d
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {urgencyPill(r)}
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
                        className={cn(CELL_FIELD, "h-10 w-16")}
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
                        className={cn(CELL_FIELD, "h-10 w-24")}
                      />
                    </td>
                    <td className="num px-4 py-2.5 text-right font-bold text-ink">
                      {n.lineTotal > 0 ? formatRWF(n.lineTotal) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {totals.cost > 0 && (
              <tfoot className="border-t border-rule bg-ground">
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-2.5 text-right text-sm font-semibold text-ink"
                  >
                    {t("totalOrderCost")}
                  </td>
                  <td className="num px-4 py-2.5 text-right text-base font-bold text-ink">
                    {formatRWF(totals.cost)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>

      {/* Send to purchase draft */}
      <Card data-tour="restock-draft" className="p-4">
        {draftError && (
          <p className="mb-2.5 rounded-panel bg-error-wash px-3.5 py-2.5 text-sm font-semibold text-error">
            {draftError}
          </p>
        )}
        <div className="flex flex-wrap items-end gap-2.5">
          <label className="block min-w-0 flex-1">
            <CaptionLabel>{t("draftSupplier")}</CaptionLabel>
            <select
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className="mt-1.5 block h-11 w-full rounded-panel border border-rule bg-surface px-3 text-sm text-ink focus:border-rule-active focus:outline-none focus:ring-1 focus:ring-rule-active"
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
            className="flex h-11 shrink-0 items-center gap-2 rounded-full bg-fab px-4 text-sm font-bold text-white shadow-fab active:translate-y-[2px] disabled:opacity-50"
          >
            <FileInput className="h-4 w-4" strokeWidth={2.2} />
            {isPending ? t("draftCreating") : t("draftCreate")}
          </button>
        </div>
        <p className="mt-2 text-[11px] text-ink-2">{t("draftHint")}</p>
      </Card>
    </>
  );
}
