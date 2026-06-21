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
  systemUnits: number;
  countedRaw: string; // keep as string so empty stays empty (not 0)
};

export function StockTakeForm({ rows }: { rows: StockTakeRow[] }) {
  const router = useRouter();
  const t = useTranslations("stockTake");
  const tc = useTranslations("common");

  const [lines, setLines] = useState<LineState[]>(() =>
    rows.map((r) => ({
      productId: r.productId,
      sku: r.sku,
      name: r.name,
      systemUnits: r.systemUnits,
      countedRaw: "",
    })),
  );
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [idempotencyKey, setIdempotencyKey] = useState(() =>
    crypto.randomUUID(),
  );

  function setCounted(productId: string, raw: string) {
    setLines((prev) =>
      prev.map((l) =>
        l.productId === productId ? { ...l, countedRaw: raw } : l,
      ),
    );
  }

  const summary = useMemo(() => {
    let counted = 0;
    let positive = 0;
    let negative = 0;
    for (const l of lines) {
      if (l.countedRaw === "") continue;
      counted += 1;
      const v = Number(l.countedRaw) - l.systemUnits;
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
        countedUnits: Number(l.countedRaw),
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
        <SummaryStat
          label={t("statOver")}
          value={summary.positive}
          tone={summary.positive > 0 ? "neutral" : "neutral"}
        />
      </section>

      {/* Lines */}
      <section
        data-tour="stock-take-lines"
        className="overflow-hidden rounded-2xl border border-zinc-200 bg-white"
      >
        <ul className="divide-y divide-zinc-100">
          {lines.map((l) => {
            const enteredEmpty = l.countedRaw === "";
            const counted = enteredEmpty ? null : Number(l.countedRaw);
            const variance =
              counted == null ? null : counted - l.systemUnits;
            const varianceTone =
              variance == null
                ? "text-zinc-400"
                : variance === 0
                  ? "text-green-700"
                  : variance > 0
                    ? "text-amber-700"
                    : "text-red-700";
            return (
              <li
                key={l.productId}
                className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-800">
                    {l.name}
                  </p>
                  <p className="font-mono text-[10px] text-zinc-500">
                    {l.sku}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-wide text-zinc-500">
                      {t("systemLabel")}
                    </p>
                    <p className="font-mono text-sm tabular-nums text-zinc-700">
                      {l.systemUnits}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-zinc-500">
                      {t("countedLabel")}
                    </p>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      step={1}
                      value={l.countedRaw}
                      onChange={(e) => setCounted(l.productId, e.target.value)}
                      placeholder="—"
                      className="mt-0.5 block h-10 w-20 rounded-lg border border-zinc-300 bg-white px-2 text-center font-mono text-base tabular-nums"
                    />
                  </div>
                  <div className="w-16 text-right">
                    <p className="text-[10px] uppercase tracking-wide text-zinc-500">
                      {t("varianceLabel")}
                    </p>
                    <p
                      className={`font-mono text-sm font-semibold tabular-nums ${varianceTone}`}
                    >
                      {variance == null
                        ? "—"
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
