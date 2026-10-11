"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, ChevronRight, History } from "lucide-react";
import { Card, CaptionLabel } from "@/components/ui";
import { cn } from "@/lib/cn";
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
      <Card data-tour="stock-take-history" className="p-4">
        <header className="flex items-center gap-2">
          <History className="h-4 w-4 text-ink-2" strokeWidth={2.2} />
          <h2 className="text-sm font-bold text-ink">{t("historyTitle")}</h2>
        </header>
        <p className="mt-2 text-xs text-ink-2">{t("historyEmpty")}</p>
      </Card>
    );
  }

  return (
    <Card data-tour="stock-take-history" className="overflow-hidden">
      <header className="flex items-center gap-2 border-b border-rule-hair px-4 py-3">
        <History className="h-4 w-4 text-ink-2" strokeWidth={2.2} />
        <h2 className="text-sm font-bold text-ink">{t("historyTitle")}</h2>
        <span className="ml-auto text-[11px] text-ink-2">
          {t("historySubtitle", { count: entries.length })}
        </span>
      </header>
      <ul>
        {entries.map((e, idx) => {
          const open = openId === e.id;
          const changedLines = e.lines.filter((l) => l.variance !== 0);
          const linesToShow = open ? e.lines : changedLines.slice(0, 0);
          return (
            <li
              key={e.id}
              className={cn(
                "px-3 py-2.5 sm:px-4",
                idx > 0 && "border-t border-rule-hair",
              )}
            >
              <button
                type="button"
                onClick={() => setOpenId(open ? null : e.id)}
                className="flex w-full items-start gap-2 text-left"
              >
                {open ? (
                  <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-ink-2" strokeWidth={2.2} />
                ) : (
                  <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-ink-2" strokeWidth={2.2} />
                )}
                <div className="min-w-0 flex-1">
                  <p className="num text-sm font-bold text-ink">
                    {fmtDateTime(e.createdAt)}
                    {e.userName ? (
                      <span className="font-semibold text-ink-2">
                        {" "}
                        · {e.userName}
                      </span>
                    ) : null}
                  </p>
                  <p className="truncate text-xs text-ink-2">{e.note}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="num text-[11px] text-ink-2">
                    {t("historyLineCount", { count: e.lineCount })}
                  </p>
                  <p
                    className={cn(
                      "num text-[11px] font-bold",
                      e.adjustedCount > 0 ? "text-warning" : "text-success",
                    )}
                  >
                    {t("historyAdjustedCount", { count: e.adjustedCount })}
                  </p>
                </div>
              </button>

              {open && (
                <div className="mt-3 space-y-3">
                  {e.note && (
                    <div className="rounded-panel bg-ground p-3">
                      <CaptionLabel>{t("historyNoteLabel")}</CaptionLabel>
                      <p className="mt-1 whitespace-pre-wrap text-xs text-ink">
                        {e.note}
                      </p>
                    </div>
                  )}
                  <div className="overflow-x-auto rounded-panel ring-1 ring-inset ring-rule-hair">
                    <table className="w-full text-xs">
                      <thead className="bg-ground text-[11px] uppercase tracking-wide text-ink-2">
                        <tr>
                          <th className="px-2 py-1.5 text-left font-semibold">
                            {t("historyColProduct")}
                          </th>
                          <th className="px-2 py-1.5 text-right font-semibold">
                            {t("historyColSystem")}
                          </th>
                          <th className="px-2 py-1.5 text-right font-semibold">
                            {t("historyColCounted")}
                          </th>
                          <th className="px-2 py-1.5 text-right font-semibold">
                            {t("varianceLabel")}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {(open ? e.lines : linesToShow).map((l, li) => (
                          <tr
                            key={l.productId}
                            className={cn(
                              li > 0 && "border-t border-rule-hair",
                            )}
                          >
                            <td className="px-2 py-1.5">
                              <p className="font-semibold text-ink">{l.name}</p>
                              <p className="num text-[10px] text-ink-2">
                                {l.sku}
                              </p>
                            </td>
                            <td className="num px-2 py-1.5 text-right text-ink-2">
                              {l.system}
                            </td>
                            <td className="num px-2 py-1.5 text-right text-ink-2">
                              <span>{l.counted}</span>
                              <span className="ml-1 text-[10px]">
                                ({l.countedCartons}×c + {l.countedLooseUnits})
                              </span>
                            </td>
                            <td
                              className={cn(
                                "num px-2 py-1.5 text-right font-bold",
                                l.variance === 0
                                  ? "text-ink-2"
                                  : l.variance > 0
                                    ? "text-warning"
                                    : "text-error",
                              )}
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
    </Card>
  );
}
