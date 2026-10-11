"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { CheckCircle2 } from "lucide-react";
import { Card, CaptionLabel } from "@/components/ui";
import { cn } from "@/lib/cn";
import { runStockTake } from "@/lib/stock-takes/actions";
import type { StockTakeRow } from "@/lib/stock-takes/queries";

type LineState = {
  productId: string;
  sku: string;
  name: string;
  unitsPerCarton: number;
  systemTotalUnits: number;
  systemSealedCartons: number;
  systemLooseUnits: number;
  cartonsRaw: string; // string so empty stays empty (not 0)
  looseRaw: string;
};

const COUNT_FIELD =
  "num mt-0.5 block h-11 w-16 rounded-panel border border-rule bg-surface px-2 text-center text-base font-semibold text-ink focus:border-rule-active focus:outline-none focus:ring-1 focus:ring-rule-active";

export function StockTakeForm({ rows }: { rows: StockTakeRow[] }) {
  const router = useRouter();
  const t = useTranslations("stockTake");

  const [lines, setLines] = useState<LineState[]>(() =>
    rows.map((r) => ({
      productId: r.productId,
      sku: r.sku,
      name: r.name,
      unitsPerCarton: r.unitsPerCarton,
      systemTotalUnits: r.systemTotalUnits,
      systemSealedCartons: r.systemSealedCartons,
      systemLooseUnits: r.systemLooseUnits,
      cartonsRaw: "",
      looseRaw: "",
    })),
  );
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [idempotencyKey, setIdempotencyKey] = useState(() =>
    crypto.randomUUID(),
  );

  function setCartons(productId: string, raw: string) {
    setLines((prev) =>
      prev.map((l) =>
        l.productId === productId ? { ...l, cartonsRaw: raw } : l,
      ),
    );
  }
  function setLoose(productId: string, raw: string) {
    setLines((prev) =>
      prev.map((l) =>
        l.productId === productId ? { ...l, looseRaw: raw } : l,
      ),
    );
  }

  /**
   * A line counts as "counted" once at least one of cartons / loose
   * has been typed (even if it's 0). That way owners with sealed-
   * only stock can leave the loose field blank — but if they leave
   * BOTH blank we treat it as not-yet-counted.
   */
  function isLineCounted(l: LineState): boolean {
    return l.cartonsRaw !== "" || l.looseRaw !== "";
  }

  function lineCountedTotal(l: LineState): number | null {
    if (!isLineCounted(l)) return null;
    const cartons = l.cartonsRaw === "" ? 0 : Number(l.cartonsRaw);
    const loose = l.looseRaw === "" ? 0 : Number(l.looseRaw);
    if (Number.isNaN(cartons) || Number.isNaN(loose)) return null;
    return cartons * l.unitsPerCarton + loose;
  }

  const summary = useMemo(() => {
    let counted = 0;
    let positive = 0;
    let negative = 0;
    for (const l of lines) {
      const total = lineCountedTotal(l);
      if (total == null) continue;
      counted += 1;
      const v = total - l.systemTotalUnits;
      if (v > 0) positive += 1;
      else if (v < 0) negative += 1;
    }
    return {
      counted,
      uncounted: lines.length - counted,
      positive,
      negative,
    };
  }, [lines]);

  const allCounted = summary.uncounted === 0;

  function handleSubmit() {
    setError(null);
    setSuccess(null);

    if (!allCounted) {
      setError(t("errorAllRequired"));
      return;
    }
    if (note.trim() === "") {
      setError(t("errorNoteRequired"));
      return;
    }

    const payload = {
      note: note.trim(),
      lines: lines.map((l) => ({
        productId: l.productId,
        countedCartons: l.cartonsRaw === "" ? 0 : Number(l.cartonsRaw),
        countedLooseUnits: l.looseRaw === "" ? 0 : Number(l.looseRaw),
      })),
    };

    startTransition(async () => {
      const result = await runStockTake(idempotencyKey, payload);
      if (!result.ok) {
        setError(result.error);
        setIdempotencyKey(crypto.randomUUID());
        return;
      }
      setSuccess(
        t("savedSummary", {
          adjusted: result.data.adjustedCount,
          total: result.data.totalProducts,
        }),
      );
      setIdempotencyKey(crypto.randomUUID());
      router.refresh();
    });
  }

  return (
    <form action={handleSubmit} className="space-y-3">
      {error && (
        <div
          role="alert"
          className="rounded-panel bg-error-wash px-3.5 py-2.5 text-sm font-semibold text-error"
        >
          {error}
        </div>
      )}
      {success && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-panel bg-success-wash px-3.5 py-2.5 text-sm font-semibold text-success"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" strokeWidth={2.2} />
          <span>{success}</span>
        </div>
      )}

      {/* Summary strip */}
      <section
        data-tour="stock-take-summary"
        className="grid grid-cols-2 gap-2.5 sm:grid-cols-4"
      >
        <SummaryStat label={t("statTotal")} value={lines.length} />
        <SummaryStat
          label={t("statUncounted")}
          value={summary.uncounted}
          tone={summary.uncounted > 0 ? "warn" : "ok"}
        />
        <SummaryStat
          label={t("statShort")}
          value={summary.negative}
          tone={summary.negative > 0 ? "warn" : "neutral"}
        />
        <SummaryStat label={t("statOver")} value={summary.positive} />
      </section>

      {/* Lines */}
      <Card data-tour="stock-take-lines" className="px-3.5 py-1">
        {lines.map((l, i) => {
          const counted = lineCountedTotal(l);
          const variance =
            counted == null ? null : counted - l.systemTotalUnits;
          const varianceTone =
            variance == null
              ? "text-ink-2"
              : variance === 0
                ? "text-success"
                : variance > 0
                  ? "text-warning"
                  : "text-error";
          const upcDisplay = l.unitsPerCarton;
          return (
            <div
              key={l.productId}
              className={cn(
                "flex flex-col gap-3 py-3 sm:flex-row sm:items-start sm:justify-between",
                i > 0 && "border-t border-rule-hair",
              )}
            >
              {/* Name + system breakdown */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-ink">
                  {l.name}
                </p>
                <p className="num text-[10px] text-ink-2">{l.sku}</p>
                <p className="num mt-1 text-[11px] text-ink-2">
                  {t("systemBreakdown", {
                    cartons: l.systemSealedCartons,
                    loose: l.systemLooseUnits,
                    total: l.systemTotalUnits,
                    unitsPerCarton: upcDisplay,
                  })}
                </p>
              </div>

              {/* Counted inputs + computed total + variance */}
              <div className="flex shrink-0 items-end gap-2">
                <label className="block text-center">
                  <CaptionLabel>{t("cartonsLabel")}</CaptionLabel>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={1}
                    value={l.cartonsRaw}
                    onChange={(e) => setCartons(l.productId, e.target.value)}
                    placeholder="—"
                    className={COUNT_FIELD}
                  />
                </label>
                <label className="block text-center">
                  <CaptionLabel>{t("looseLabel")}</CaptionLabel>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={1}
                    value={l.looseRaw}
                    onChange={(e) => setLoose(l.productId, e.target.value)}
                    placeholder="—"
                    className={COUNT_FIELD}
                  />
                </label>
                <div className="w-20 text-right">
                  <CaptionLabel>{t("countedTotalLabel")}</CaptionLabel>
                  <p className="num mt-0.5 text-sm font-bold text-ink">
                    {counted == null ? "—" : counted}
                  </p>
                  <p
                    className={cn(
                      "num text-[11px] font-bold",
                      varianceTone,
                    )}
                  >
                    {variance == null
                      ? ""
                      : variance > 0
                        ? `+${variance}`
                        : variance}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </Card>

      {/* Note */}
      <label className="block" data-tour="stock-take-note">
        <CaptionLabel>{t("noteLabel")}</CaptionLabel>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          required
          placeholder={t("notePlaceholder")}
          className="mt-1.5 block w-full rounded-panel border border-rule bg-surface px-3 py-2.5 text-sm text-ink focus:border-rule-active focus:outline-none focus:ring-1 focus:ring-rule-active"
        />
        <span className="mt-1 block text-xs text-ink-2">{t("noteHint")}</span>
      </label>

      <button
        type="submit"
        disabled={isPending || !allCounted || note.trim() === ""}
        className="h-12 w-full rounded-full bg-fab px-4 text-sm font-bold text-white shadow-fab active:translate-y-[2px] disabled:opacity-60"
      >
        {isPending
          ? t("saving")
          : t("save", { count: summary.negative + summary.positive })}
      </button>

      <p className="text-center text-xs text-ink-2">{t("scopeNote")}</p>
    </form>
  );
}

function SummaryStat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "neutral" | "ok" | "warn";
}) {
  const valueCls =
    tone === "warn"
      ? "text-warning"
      : tone === "ok"
        ? "text-success"
        : "text-ink";
  return (
    <Card className="p-3">
      <CaptionLabel>{label}</CaptionLabel>
      <p className={cn("num mt-0.5 text-lg font-bold", valueCls)}>{value}</p>
    </Card>
  );
}
