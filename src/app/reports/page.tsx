import Link from "next/link";
import { Download } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireOwner } from "@/lib/auth-guards";
import { formatRWF } from "@/lib/format";
import { computeDailySummary } from "@/lib/reports/daily";
import { STOCK_REASON_LABEL } from "@/lib/copy";
import { Card, CaptionLabel } from "@/components/ui";
import { cn } from "@/lib/cn";

function parseDateParam(s?: string): Date {
  if (!s) return new Date();
  const parsed = new Date(s + "T00:00:00");
  if (Number.isNaN(parsed.getTime())) return new Date();
  return parsed;
}

function toDateInput(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function adjustDate(d: Date, days: number): string {
  const c = new Date(d);
  c.setDate(c.getDate() + days);
  return toDateInput(c);
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  await requireOwner();

  const sp = await searchParams;
  const date = parseDateParam(sp.date);
  const summary = await computeDailySummary(date);
  const dateLabel = date.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const t = await getTranslations("reports");
  const tc = await getTranslations("common");

  return (
    <main className="mx-auto max-w-5xl space-y-3 p-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-ink">{t("title")}</h1>
          <p className="text-[13px] text-ink-2">{dateLabel}</p>
          <Link
            href="/reports/register"
            className="mt-2 inline-flex h-9 items-center gap-1.5 rounded-full bg-surface px-3.5 text-[13px] font-bold text-primary ring-1 ring-inset ring-rule"
          >
            <Download className="h-3.5 w-3.5" strokeWidth={2.2} />
            {t("registerLink")}
          </Link>
        </div>
        <form method="get" className="flex items-center gap-2">
          <Link
            href={`/reports?date=${adjustDate(date, -1)}`}
            className="flex h-10 items-center rounded-full bg-surface px-3.5 text-[13px] font-bold text-ink-2 ring-1 ring-inset ring-rule"
          >
            ← {t("prev")}
          </Link>
          <input
            type="date"
            name="date"
            defaultValue={toDateInput(date)}
            aria-label={tc("date")}
            className="h-10 rounded-panel border border-rule bg-surface px-2.5 text-[13px] text-ink-2"
          />
          <button
            type="submit"
            className="h-10 rounded-full bg-surface px-4 text-[13px] font-bold text-primary ring-1 ring-inset ring-rule"
          >
            {t("go")}
          </button>
          <Link
            href={`/reports?date=${adjustDate(date, 1)}`}
            className="flex h-10 items-center rounded-full bg-surface px-3.5 text-[13px] font-bold text-ink-2 ring-1 ring-inset ring-rule"
          >
            {t("next")} →
          </Link>
        </form>
      </header>

      <section className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <StatCard
          label={t("statSales")}
          value={formatRWF(summary.totals.salesTotal)}
          hint={t("salesCountHint", { count: summary.totals.salesCount })}
        />
        <StatCard
          label={t("statCashSales")}
          value={formatRWF(summary.totals.cashSalesTotal)}
        />
        <StatCard
          label={t("statExpenses")}
          value={formatRWF(summary.totals.expensesTotal)}
          hint={t("inclCashHint", {
            amount: formatRWF(summary.totals.cashExpensesTotal),
          })}
        />
        <StatCard
          label={t("statNetCash")}
          value={formatRWF(summary.totals.netCash)}
          tone={summary.totals.netCash >= 0 ? "ok" : "warn"}
        />
      </section>

      {summary.totals.discountedLineCount > 0 && (
        <section className="rounded-panel bg-warning-wash px-3.5 py-2.5 text-sm font-semibold text-warning">
          <p>
            {t("discounts", {
              amount: formatRWF(summary.totals.discountsTotal),
              count: summary.totals.discountedLineCount,
            })}
            {summary.totals.floorOverrideCount > 0
              ? ` — ${t("discountOverrides", {
                  count: summary.totals.floorOverrideCount,
                })}`
              : ""}
            .
          </p>
        </section>
      )}

      <section className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Table
          title={t("salesByChannel")}
          headers={[t("colChannel"), t("colCount"), t("colTotal")]}
          rows={summary.salesByChannel.map((r) => [
            r.channelName,
            r.count.toString(),
            formatRWF(r.total),
          ])}
          empty={t("emptySales")}
        />
        <Table
          title={t("salesByMethod")}
          headers={[t("colMethod"), t("colCount"), t("colTotal")]}
          rows={summary.salesByMethod.map((r) => [
            r.paymentMethod,
            r.count.toString(),
            formatRWF(r.total),
          ])}
          empty="—"
        />
        <Table
          title={t("topProducts")}
          headers={[t("colProduct"), t("colQty"), t("colRevenue")]}
          rows={summary.topProducts.map((r) => [
            `${r.name} (${r.sku})`,
            r.unitsSold.toString(),
            formatRWF(r.saleLineTotal),
          ])}
          empty={t("emptySales")}
        />
        <Table
          title={t("expensesByCategory")}
          headers={[t("colCategory"), t("colCount"), t("colTotal")]}
          rows={summary.expensesByCategory.map((r) => [
            r.categoryName,
            r.count.toString(),
            formatRWF(r.total),
          ])}
          empty={t("emptyExpenses")}
        />
        <Table
          title={t("stockMoves")}
          headers={[t("colReason"), t("colCount"), t("colNetUnits")]}
          rows={summary.stockMovesByReason.map((r) => [
            STOCK_REASON_LABEL[r.reason] ?? r.reason,
            r.moveCount.toString(),
            r.netUnits > 0 ? `+${r.netUnits}` : r.netUnits.toString(),
          ])}
          empty={t("emptyMoves")}
        />
        <CashSessionsCard
          sessions={summary.cashSessions}
          title={t("cashSessions")}
          empty={t("emptySessions")}
          stillOpen={t("stillOpen")}
          floatLabel={(amount) => t("sessionFloat", { amount })}
          expectedLabel={(expected, counted) =>
            t("sessionExpected", { expected, counted })
          }
        />
      </section>
    </main>
  );
}

function StatCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "ok" | "warn";
}) {
  return (
    <div
      className={cn(
        "rounded-card p-4 ring-1 ring-inset",
        tone === "warn"
          ? "bg-warning-wash ring-rule-hair"
          : tone === "ok"
            ? "bg-success-wash ring-[#bbe7c8]"
            : "bg-surface ring-rule-hair",
      )}
    >
      <CaptionLabel
        className={
          tone === "warn"
            ? "text-warning"
            : tone === "ok"
              ? "text-success"
              : undefined
        }
      >
        {label}
      </CaptionLabel>
      <p
        className={cn(
          "num mt-1 text-xl font-bold",
          tone === "warn"
            ? "text-warning"
            : tone === "ok"
              ? "text-success"
              : "text-ink",
        )}
      >
        {value}
      </p>
      {hint && <p className="num mt-1 text-xs text-ink-2">{hint}</p>}
    </div>
  );
}

function Table({
  title,
  headers,
  rows,
  empty,
}: {
  title: string;
  headers: string[];
  rows: string[][];
  empty: string;
}) {
  return (
    <Card className="overflow-hidden">
      <h2 className="border-b border-rule-hair bg-ground px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-ink-2">
        {title}
      </h2>
      {rows.length === 0 ? (
        <p className="px-3 py-6 text-center text-sm text-ink-2">{empty}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-ground text-[11px] uppercase tracking-wide text-ink-2">
              <tr>
                {headers.map((h, i) => (
                  <th
                    key={i}
                    className={cn(
                      "px-3 py-2 text-left font-semibold",
                      i > 0 && "text-right",
                    )}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className={cn(i > 0 && "border-t border-rule-hair")}>
                  {row.map((cell, j) => (
                    <td
                      key={j}
                      className={cn(
                        "px-3 py-2 text-ink",
                        j > 0 && "num text-right",
                      )}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function CashSessionsCard({
  sessions,
  title,
  empty,
  stillOpen,
  floatLabel,
  expectedLabel,
}: {
  sessions: Array<{
    id: string;
    openedAt: Date;
    closedAt: Date | null;
    openingFloat: number;
    expectedCash: number | null;
    closingCount: number | null;
    variance: number | null;
    openedBy: string;
    closedBy: string | null;
  }>;
  title: string;
  empty: string;
  stillOpen: string;
  floatLabel: (amount: string) => string;
  expectedLabel: (expected: string, counted: string) => string;
}) {
  return (
    <Card className="overflow-hidden">
      <h2 className="border-b border-rule-hair bg-ground px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-ink-2">
        {title}
      </h2>
      {sessions.length === 0 ? (
        <p className="px-3 py-6 text-center text-sm text-ink-2">{empty}</p>
      ) : (
        <ul>
          {sessions.map((s, i) => (
            <li
              key={s.id}
              className={cn(
                "px-3.5 py-2.5 text-sm",
                i > 0 && "border-t border-rule-hair",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="num font-bold text-ink">
                  {new Date(s.openedAt).toLocaleTimeString()} →{" "}
                  {s.closedAt
                    ? new Date(s.closedAt).toLocaleTimeString()
                    : stillOpen}
                </p>
                {s.variance !== null && (
                  <span
                    className={cn(
                      "num text-xs font-bold",
                      s.variance === 0
                        ? "text-success"
                        : s.variance > 0
                          ? "text-warning"
                          : "text-error",
                    )}
                  >
                    {s.variance >= 0 ? "+" : ""}
                    {formatRWF(s.variance)}
                  </span>
                )}
              </div>
              <p className="num mt-0.5 text-[10px] text-ink-2">
                {floatLabel(formatRWF(s.openingFloat))}
                {s.expectedCash !== null
                  ? ` · ${expectedLabel(
                      formatRWF(s.expectedCash),
                      formatRWF(s.closingCount ?? 0),
                    )}`
                  : ""}{" "}
                · {s.openedBy}
                {s.closedBy && ` → ${s.closedBy}`}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
