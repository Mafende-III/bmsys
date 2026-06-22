"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { CheckCircle2 } from "lucide-react";
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
    <form action={handleSubmit} className="space-y-5">
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}
      {success && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" strokeWidth={2} />
          <span>{success}</span>
        </div>
      )}

      {/* Summary strip */}
      <section
        data-tour="stock-take-summary"
        className="grid grid-cols-2 gap-2 rounded-2xl border border-zinc-200 bg-white p-3 text-xs sm:grid-cols-4"
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
      <section
        data-tour="stock-take-lines"
        className="overflow-hidden rounded-2xl border border-zinc-200 bg-white"
      >
        <ul className="divide-y divide-zinc-100">
          {lines.map((l) => {
            const counted = lineCountedTotal(l);
            const variance =
              counted == null ? null : counted - l.systemTotalUnits;
            const varianceTone =
              variance == null
                ? "text-zinc-400"
                : variance === 0
                  ? "text-green-700"
                  : variance > 0
                    ? "text-amber-700"
                    : "text-red-700";
            const upcDisplay = l.unitsPerCarton;
            return (
              <li
                key={l.productId}
                className="flex flex-col gap-3 p-3 sm:flex-row sm:items-start sm:justify-between"
              >
                {/* Name + system breakdown */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-800">
                    {l.name}
                  </p>
                  <p className="font-mono text-[10px] text-zinc-500">{l.sku}</p>
                  <p className="mt-1 text-[11px] text-zinc-600">
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
                  <div className="text-center">
                    <p className="text-[10px] uppercase tracking-wide text-zinc-500">
                      {t("cartonsLabel")}
                    </p>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      step={1}
                      value={l.cartonsRaw}
                      onChange={(e) => setCartons(l.productId, e.target.value)}
                      placeholder="—"
                      className="mt-0.5 block h-10 w-16 rounded-lg border border-zinc-300 bg-white px-2 text-center font-mono text-base tabular-nums"
                    />
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] uppercase tracking-wide text-zinc-500">
                      {t("looseLabel")}
                    </p>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      step={1}
                      value={l.looseRaw}
                      onChange={(e) => setLoose(l.productId, e.target.value)}
                      placeholder="—"
                      className="mt-0.5 block h-10 w-16 rounded-lg border border-zinc-300 bg-white px-2 text-center font-mono text-base tabular-nums"
                    />
                  </div>
                  <div className="w-20 text-right">
                    <p className="text-[10px] uppercase tracking-wide text-zinc-500">
                      {t("countedTotalLabel")}
                    </p>
                    <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-zinc-800">
                      {counted == null ? "—" : counted}
                    </p>
                    <p
                      className={`text-[11px] font-mono font-semibold tabular-nums ${varianceTone}`}
                    >
                      {variance == null
                        ? ""
                        : variance > 0
                          ? `+${variance}`
                          : variance}
                    </p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Note */}
      <label className="block" data-tour="stock-take-note">
        <span className="text-sm font-medium">{t("noteLabel")}</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          required
          placeholder={t("notePlaceholder")}
          className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        />
        <span className="mt-1 block text-xs text-zinc-500">
          {t("noteHint")}
        </span>
      </label>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending || !allCounted || note.trim() === ""}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
        >
          {isPending
            ? t("saving")
            : t("save", { count: summary.negative + summary.positive })}
        </button>
      </div>

      <p className="text-center text-xs text-zinc-500">{t("scopeNote")}</p>
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
      ? "text-amber-700"
      : tone === "ok"
        ? "text-green-700"
        : "text-zinc-900";
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-zinc-500">
        {label}
      </p>
      <p className={`mt-0.5 font-mono text-lg font-semibold tabular-nums ${valueCls}`}>
        {value}
      </p>
    </div>
  );
}
