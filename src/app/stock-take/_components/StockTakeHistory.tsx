"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, ChevronRight, History } from "lucide-react";
import type { StockTakeHistoryEntry } from "@/lib/stock-takes/queries";

export function StockTakeHistory({
  entries,
  locale,
}: {
  entries: StockTakeHistoryEntry[];
  locale: string;
}) {
  const t = useTranslations("stockTake");
  const [openId, setOpenId] = useState<string | null>(null);

  const fmtDateTime = (d: Date) =>
    new Date(d).toLocaleString(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  if (entries.length === 0) {
    return (
      <section
        data-tour="stock-take-history"
        className="rounded-2xl border border-zinc-200 bg-white p-4"
      >
        <header className="flex items-center gap-2">
          <History className="h-4 w-4 text-zinc-500" />
          <h2 className="text-sm font-semibold text-zinc-800">
            {t("historyTitle")}
          </h2>
        </header>
        <p className="mt-2 text-xs text-zinc-500">{t("historyEmpty")}</p>
      </section>
    );
  }

  return (
    <section
      data-tour="stock-take-history"
      className="overflow-hidden rounded-2xl border border-zinc-200 bg-white"
    >
      <header className="flex items-center gap-2 border-b border-zinc-100 px-4 py-3">
        <History className="h-4 w-4 text-zinc-500" />
        <h2 className="text-sm font-semibold text-zinc-800">
          {t("historyTitle")}
        </h2>
        <span className="ml-auto text-[11px] text-zinc-500">
          {t("historySubtitle", { count: entries.length })}
        </span>
      </header>
      <ul className="divide-y divide-zinc-100">
        {entries.map((e) => {
          const open = openId === e.id;
          const changedLines = e.lines.filter((l) => l.variance !== 0);
          const linesToShow = open ? e.lines : changedLines.slice(0, 0);
          return (
            <li key={e.id} className="px-3 py-2 sm:px-4">
              <button
                type="button"
                onClick={() => setOpenId(open ? null : e.id)}
                className="flex w-full items-start gap-2 text-left"
              >
                {open ? (
                  <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" />
                ) : (
                  <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-zinc-800">
                    {fmtDateTime(e.createdAt)}
                    {e.userName ? (
                      <span className="text-zinc-500"> · {e.userName}</span>
                    ) : null}
                  </p>
                  <p className="truncate text-xs text-zinc-600">{e.note}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[11px] text-zinc-500">
                    {t("historyLineCount", { count: e.lineCount })}
                  </p>
                  <p
                    className={`text-[11px] font-medium ${
                      e.adjustedCount > 0 ? "text-amber-700" : "text-green-700"
                    }`}
                  >
                    {t("historyAdjustedCount", { count: e.adjustedCount })}
                  </p>
                </div>
              </button>

              {open && (
                <div className="mt-3 space-y-3">
                  {e.note && (
                    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                      <p className="text-[10px] uppercase tracking-wide text-zinc-500">
                        {t("historyNoteLabel")}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-xs text-zinc-800">
                        {e.note}
                      </p>
                    </div>
                  )}
                  <div className="overflow-x-auto rounded-lg border border-zinc-100">
                    <table className="w-full text-xs">
                      <thead className="bg-zinc-50 text-zinc-600">
                        <tr>
                          <th className="px-2 py-1.5 text-left font-medium">
                            {t("historyColProduct")}
                          </th>
                          <th className="px-2 py-1.5 text-right font-medium">
                            {t("historyColSystem")}
                          </th>
                          <th className="px-2 py-1.5 text-right font-medium">
                            {t("historyColCounted")}
                          </th>
                          <th className="px-2 py-1.5 text-right font-medium">
                            {t("varianceLabel")}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {(open ? e.lines : linesToShow).map((l) => (
                          <tr key={l.productId}>
                            <td className="px-2 py-1.5">
                              <p className="text-zinc-800">{l.name}</p>
                              <p className="font-mono text-[10px] text-zinc-500">
                                {l.sku}
                              </p>
                            </td>
                            <td className="px-2 py-1.5 text-right font-mono tabular-nums text-zinc-700">
                              {l.system}
                            </td>
                            <td className="px-2 py-1.5 text-right font-mono tabular-nums text-zinc-700">
                              <span>{l.counted}</span>
                              <span className="ml-1 text-[10px] text-zinc-500">
                                ({l.countedCartons}×c + {l.countedLooseUnits})
                              </span>
                            </td>
                            <td
                              className={`px-2 py-1.5 text-right font-mono font-semibold tabular-nums ${
                                l.variance === 0
                                  ? "text-zinc-400"
                                  : l.variance > 0
                                    ? "text-amber-700"
                                    : "text-red-700"
                              }`}
                            >
                              {l.variance > 0 ? `+${l.variance}` : l.variance}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
