import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireOwner } from "@/lib/auth-guards";
import { formatRWF } from "@/lib/format";
import { computeDailySummary } from "@/lib/reports/daily";
import { STOCK_REASON_LABEL } from "@/lib/copy";

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
    <main className="mx-auto max-w-5xl p-4 sm:p-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link
            href="/dashboard"
            className="text-sm text-zinc-600 hover:underline"
          >
            ← {tc("dashboard")}
          </Link>
          <h1 className="mt-1 text-2xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-zinc-600">{dateLabel}</p>
        </div>
        <form method="get" className="flex items-end gap-2">
          <Link
            href={`/reports?date=${adjustDate(date, -1)}`}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium hover:bg-zinc-50"
          >
            ← Prev
          </Link>
          <label className="block">
            <span className="text-xs font-medium text-zinc-700">Date</span>
            <input
              type="date"
              name="date"
              defaultValue={toDateInput(date)}
              className="mt-1 block rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
          </label>
          <button
            type="submit"
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium hover:bg-zinc-50"
          >
            Go
          </button>
          <Link
            href={`/reports?date=${adjustDate(date, 1)}`}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium hover:bg-zinc-50"
          >
            Next →
          </Link>
        </form>
      </header>

      <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card label="Sales" value={formatRWF(summary.totals.salesTotal)} hint={`${summary.totals.salesCount} sales`} />
        <Card label="Cash sales" value={formatRWF(summary.totals.cashSalesTotal)} />
        <Card label="Expenses" value={formatRWF(summary.totals.expensesTotal)} hint={`incl. ${formatRWF(summary.totals.cashExpensesTotal)} cash`} />
        <Card label="Net cash flow" value={formatRWF(summary.totals.netCash)} tone={summary.totals.netCash >= 0 ? "ok" : "warn"} />
      </section>

      <section className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Table
          title="Sales by channel"
          headers={["Channel", "#", "Total"]}
          rows={summary.salesByChannel.map((r) => [
            r.channelName,
            r.count.toString(),
            formatRWF(r.total),
          ])}
          empty="No sales on this day."
        />
        <Table
          title="Sales by payment method"
          headers={["Method", "#", "Total"]}
          rows={summary.salesByMethod.map((r) => [
            r.paymentMethod,
            r.count.toString(),
            formatRWF(r.total),
          ])}
          empty="—"
        />
        <Table
          title="Top products"
          headers={["Product", "Qty", "Revenue"]}
          rows={summary.topProducts.map((r) => [
            `${r.name} (${r.sku})`,
            r.unitsSold.toString(),
            formatRWF(r.saleLineTotal),
          ])}
          empty="No sales on this day."
        />
        <Table
          title="Expenses by category"
          headers={["Category", "#", "Total"]}
          rows={summary.expensesByCategory.map((r) => [
            r.categoryName,
            r.count.toString(),
            formatRWF(r.total),
          ])}
          empty="No expenses on this day."
        />
        <Table
          title="Stock movements"
          headers={["Reason", "#", "Net units"]}
          rows={summary.stockMovesByReason.map((r) => [
            STOCK_REASON_LABEL[r.reason] ?? r.reason,
            r.moveCount.toString(),
            r.netUnits > 0 ? `+${r.netUnits}` : r.netUnits.toString(),
          ])}
          empty="No stock movements."
        />
        <CashSessionsCard sessions={summary.cashSessions} />
      </section>
    </main>
  );
}

function Card({
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
  const tint =
    tone === "warn"
      ? "border-amber-200 bg-amber-50"
      : tone === "ok"
        ? "border-green-200 bg-green-50"
        : "border-zinc-200 bg-white";
  return (
    <div className={`rounded-2xl border p-4 ${tint}`}>
      <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 font-mono text-xl font-medium tabular-nums">
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-zinc-500">{hint}</p>}
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
    <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
      <h2 className="border-b border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-medium">
        {title}
      </h2>
      {rows.length === 0 ? (
        <p className="px-3 py-6 text-center text-sm text-zinc-500">{empty}</p>
      ) : (
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs font-medium uppercase text-zinc-600">
            <tr>
              {headers.map((h, i) => (
                <th
                  key={i}
                  className={`px-3 py-2 ${i > 0 ? "text-right" : ""}`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-t border-zinc-200">
                {row.map((cell, j) => (
                  <td
                    key={j}
                    className={`px-3 py-2 ${j > 0 ? "text-right font-mono tabular-nums" : ""}`}
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
    </section>
  );
}

function CashSessionsCard({
  sessions,
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
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
      <h2 className="border-b border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-medium">
        Cash sessions
      </h2>
      {sessions.length === 0 ? (
        <p className="px-3 py-6 text-center text-sm text-zinc-500">
          No cash sessions touched this day.
        </p>
      ) : (
        <ul className="divide-y divide-zinc-200">
          {sessions.map((s) => (
            <li key={s.id} className="px-3 py-2 text-sm">
              <div className="flex items-center justify-between">
                <p className="font-medium">
                  {new Date(s.openedAt).toLocaleTimeString()} →{" "}
                  {s.closedAt
                    ? new Date(s.closedAt).toLocaleTimeString()
                    : "still open"}
                </p>
                {s.variance !== null && (
                  <span
                    className={`font-mono text-xs tabular-nums ${
                      s.variance === 0
                        ? "text-green-700"
                        : s.variance > 0
                          ? "text-amber-700"
                          : "text-red-700"
                    }`}
                  >
                    {s.variance >= 0 ? "+" : ""}
                    {formatRWF(s.variance)}
                  </span>
                )}
              </div>
              <p className="text-[10px] text-zinc-500">
                Float {formatRWF(s.openingFloat)}
                {s.expectedCash !== null
                  ? ` · expected ${formatRWF(s.expectedCash)} · counted ${formatRWF(s.closingCount ?? 0)}`
                  : ""}{" "}
                · {s.openedBy}
                {s.closedBy && ` → ${s.closedBy}`}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
