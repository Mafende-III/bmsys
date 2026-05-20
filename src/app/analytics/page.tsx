import Link from "next/link";
import {
  AlertTriangle,
  Banknote,
  LineChart,
  PackageX,
  ShoppingCart,
  Wallet,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireOwner } from "@/lib/auth-guards";
import {
  getChannelBreakdown,
  getExpenseBreakdown,
  getOverviewKPIs,
  getSalesByDay,
  getStockHealth,
  getTopProducts,
} from "@/lib/analytics/queries";
import {
  DEFAULT_PERIOD,
  isPeriodKey,
  PERIOD_KEYS,
  resolvePeriod,
  type PeriodKey,
} from "@/lib/analytics/period";
import { formatRWF } from "@/lib/format";
import { DonutChart } from "./_components/DonutChart";
import { SalesByDayChart } from "./_components/SalesByDayChart";
import { TopSellersChart } from "./_components/TopSellersChart";

type SearchParams = { period?: string; from?: string; to?: string };

function parseDateParam(s: string | undefined): Date | null {
  if (!s) return null;
  // "yyyy-MM-dd" — anchor to local midnight to match user intent.
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const date = new Date(y, mo - 1, d);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireOwner();
  const sp = await searchParams;
  const periodKey: PeriodKey = isPeriodKey(sp.period)
    ? sp.period
    : DEFAULT_PERIOD;
  const customFrom = parseDateParam(sp.from);
  const customTo = parseDateParam(sp.to);
  const period = resolvePeriod(periodKey, new Date(), {
    customFrom,
    customTo,
  });

  const [kpis, daily, top, channels, expensesByCat, stock] = await Promise.all([
    getOverviewKPIs(period),
    getSalesByDay(period),
    getTopProducts(period, 5),
    getChannelBreakdown(period),
    getExpenseBreakdown(period),
    getStockHealth(),
  ]);

  const t = await getTranslations("analytics");
  const tc = await getTranslations("common");

  const periodLabel: Record<PeriodKey, string> = {
    week: t("periodWeek"),
    month: t("periodMonth"),
    last_month: t("periodLastMonth"),
    "7d": t("period7d"),
    "30d": t("period30d"),
    custom: t("periodCustom"),
  };

  // Pre-fill date inputs with the resolved range so the user can
  // tweak from a familiar starting point.
  const fromValue = toYmd(period.from);
  const toValue = toYmd(period.to);

  const maxDay = daily.reduce(
    (m, d) => (d.total > m.total ? d : m),
    daily[0] ?? { date: new Date(), total: 0, count: 0 },
  );
  const minDay = daily
    .filter((d) => d.total > 0)
    .reduce<typeof daily[number] | null>(
      (m, d) => (m === null || d.total < m.total ? d : m),
      null,
    );
  return (
    <main className="mx-auto max-w-6xl p-4 sm:p-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link
            href="/dashboard"
            className="text-sm text-zinc-600 hover:underline"
          >
            ← {tc("dashboard")}
          </Link>
          <h1 className="mt-1 text-2xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-zinc-600">{t("subtitle")}</p>
        </div>
        <form
          method="get"
          className="flex flex-wrap items-end gap-2"
          data-tour="analytics-period"
        >
          <label className="block">
            <span className="text-xs font-medium text-zinc-700">
              {t("periodLabel")}
            </span>
            <select
              name="period"
              defaultValue={periodKey}
              className="mt-1 block rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            >
              {PERIOD_KEYS.map((k) => (
                <option key={k} value={k}>
                  {periodLabel[k]}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-zinc-700">
              {t("fromDate")}
            </span>
            <input
              type="date"
              name="from"
              defaultValue={fromValue}
              className="mt-1 block rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-zinc-700">
              {t("toDate")}
            </span>
            <input
              type="date"
              name="to"
              defaultValue={toValue}
              className="mt-1 block rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
          </label>
          <button
            type="submit"
            className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium hover:bg-zinc-50"
          >
            {tc("filter")}
          </button>
          <p className="basis-full text-[10px] text-zinc-500">
            {t("customDatesHint")}
          </p>
        </form>
      </header>

      {/* KPI cards */}
      <section
        data-tour="analytics-kpis"
        className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        <KpiCard
          icon={ShoppingCart}
          label={t("kpiRevenue")}
          value={kpis.revenue}
          prev={kpis.prev.revenue}
          higherIsBetter
          renderDelta={(d) => t("vsPrev", { delta: d })}
        />
        <KpiCard
          icon={PackageX}
          label={t("kpiCogs")}
          value={kpis.cogs}
          prev={kpis.prev.cogs}
          higherIsBetter={false}
          renderDelta={(d) => t("vsPrev", { delta: d })}
        />
        <KpiCard
          icon={Wallet}
          label={t("kpiExpenses")}
          value={kpis.expenses}
          prev={kpis.prev.expenses}
          higherIsBetter={false}
          renderDelta={(d) => t("vsPrev", { delta: d })}
        />
        <KpiCard
          icon={Banknote}
          label={t("kpiNet")}
          value={kpis.net}
          prev={kpis.prev.net}
          higherIsBetter
          renderDelta={(d) => t("vsPrev", { delta: d })}
          emphasized
        />
      </section>

      {/* Sales by day */}
      <section
        data-tour="analytics-daily"
        className="mt-6 rounded-2xl border border-zinc-200 bg-white p-4"
      >
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-base font-medium">{t("salesByDay")}</h2>
            <p className="mt-0.5 text-xs text-zinc-600">
              {t("salesByDayHint")}
            </p>
          </div>
          <div className="text-xs text-zinc-600">
            {maxDay.total > 0 && (
              <span className="mr-3">
                <span className="font-medium text-green-700">
                  {t("highestDay")}:
                </span>{" "}
                {maxDay.date.toLocaleDateString(undefined, {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                })}{" "}
                <span className="font-mono">{formatRWF(maxDay.total)}</span>
              </span>
            )}
            {minDay && (
              <span>
                <span className="font-medium text-amber-700">
                  {t("lowestDay")}:
                </span>{" "}
                {minDay.date.toLocaleDateString(undefined, {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                })}{" "}
                <span className="font-mono">{formatRWF(minDay.total)}</span>
              </span>
            )}
          </div>
        </div>
        {kpis.revenue === 0 ? (
          <div className="mt-6 flex flex-col items-center gap-2 py-8 text-center text-zinc-500">
            <LineChart className="h-10 w-10 text-zinc-300" strokeWidth={1.5} />
            <p className="text-sm font-medium text-zinc-700">
              {t("noSalesYet")}
            </p>
            <p className="text-xs">{t("noSalesHint")}</p>
          </div>
        ) : (
          <div className="mt-4">
            <SalesByDayChart
              data={daily.map((d) => ({
                iso: d.date.toISOString(),
                label: d.date.toLocaleDateString(undefined, {
                  day: "numeric",
                  month: "short",
                }),
                total: d.total,
                count: d.count,
              }))}
            />
          </div>
        )}
      </section>

      {/* Two-column: top products + channels */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-zinc-200 bg-white p-4">
          <h2 className="text-base font-medium">{t("topProducts")}</h2>
          <p className="mt-0.5 text-xs text-zinc-600">{t("topProductsHint")}</p>
          {top.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-500">{t("noData")}</p>
          ) : (
            <div className="mt-4">
              <TopSellersChart data={top} />
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-4">
          <h2 className="text-base font-medium">{t("channels")}</h2>
          <p className="mt-0.5 text-xs text-zinc-600">{t("channelsHint")}</p>
          {channels.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-500">{t("noData")}</p>
          ) : (
            <div className="mt-4">
              <DonutChart
                totalLabel={t("salesTotal")}
                data={channels.map((c) => ({
                  id: c.channelId,
                  label: c.channelName,
                  value: c.total,
                }))}
              />
            </div>
          )}
        </section>
      </div>

      {/* Two-column: stock health + expenses */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section
          data-tour="analytics-stock"
          className="rounded-2xl border border-zinc-200 bg-white p-4"
        >
          <h2 className="text-base font-medium">{t("stockHealth")}</h2>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
              <dt className="text-xs text-zinc-600">{t("stockValue")}</dt>
              <dd className="mt-1 font-mono text-lg font-semibold tabular-nums">
                {formatRWF(stock.totalStockValue)}
              </dd>
              <dd className="mt-0.5 text-[10px] text-zinc-500">
                {t("stockValueNote")}
              </dd>
            </div>
            <div
              className={`rounded-lg border p-3 ${
                stock.outOfStock.length > 0
                  ? "border-red-200 bg-red-50"
                  : "border-zinc-200 bg-zinc-50"
              }`}
            >
              <dt className="flex items-center gap-1 text-xs text-zinc-700">
                <PackageX className="h-3 w-3" /> {t("outOfStockCount", { count: stock.outOfStock.length })}
              </dt>
              {stock.outOfStock.length > 0 && (
                <dd className="mt-1 text-xs text-red-700">
                  {stock.outOfStock
                    .slice(0, 3)
                    .map((p) => p.name)
                    .join(", ")}
                  {stock.outOfStock.length > 3 && "…"}
                </dd>
              )}
            </div>
            <div
              className={`col-span-2 rounded-lg border p-3 ${
                stock.lowStock.length > 0
                  ? "border-amber-200 bg-amber-50"
                  : "border-zinc-200 bg-zinc-50"
              }`}
            >
              <dt className="flex items-center gap-1 text-xs text-zinc-700">
                <AlertTriangle className="h-3 w-3" /> {t("lowStockCount", { count: stock.lowStock.length })}
              </dt>
              {stock.lowStock.length > 0 && (
                <dd className="mt-2 space-y-1">
                  {stock.lowStock.slice(0, 5).map((p) => (
                    <div
                      key={p.productId}
                      className="flex items-center justify-between text-xs"
                    >
                      <span className="truncate text-amber-900">{p.name}</span>
                      <span className="font-mono text-amber-800">
                        {p.units}/{p.threshold}
                      </span>
                    </div>
                  ))}
                  {stock.lowStock.length > 5 && (
                    <Link
                      href="/products"
                      className="text-xs text-amber-900 underline"
                    >
                      {t("viewAll")} →
                    </Link>
                  )}
                </dd>
              )}
            </div>
          </dl>
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-4">
          <h2 className="text-base font-medium">{t("expenses")}</h2>
          <p className="mt-0.5 text-xs text-zinc-600">{t("expensesHint")}</p>
          {expensesByCat.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-500">{t("noData")}</p>
          ) : (
            <div className="mt-4">
              <DonutChart
                totalLabel={t("expensesTotal")}
                data={expensesByCat.map((e) => ({
                  id: e.categoryId,
                  label: e.categoryName,
                  value: e.total,
                }))}
              />
            </div>
          )}
        </section>
      </div>

      <p className="mt-4 text-xs italic text-zinc-500">
        {t("currentCostNote")}
      </p>
    </main>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  prev,
  higherIsBetter,
  renderDelta,
  emphasized,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  value: number;
  prev: number;
  higherIsBetter: boolean;
  renderDelta: (deltaStr: string) => string;
  emphasized?: boolean;
}) {
  const delta = value - prev;
  const pct =
    prev !== 0 ? Math.round((delta / Math.abs(prev)) * 100) : value === 0 ? 0 : null;
  const positive = higherIsBetter ? delta >= 0 : delta <= 0;
  const tone = delta === 0 ? "text-zinc-500" : positive ? "text-green-700" : "text-red-700";
  const arrow = delta === 0 ? "·" : delta > 0 ? "▲" : "▼";
  const deltaStr =
    pct === null
      ? `${arrow} ${formatRWF(Math.abs(delta))}`
      : `${arrow} ${Math.abs(pct)}%`;

  return (
    <div
      className={`rounded-2xl border p-4 ${
        emphasized
          ? "border-zinc-900 bg-zinc-900 text-white"
          : "border-zinc-200 bg-white"
      }`}
    >
      <div className="flex items-center gap-2">
        <Icon
          className={`h-4 w-4 ${emphasized ? "text-zinc-300" : "text-zinc-500"}`}
          strokeWidth={2}
        />
        <p
          className={`text-xs font-medium uppercase tracking-wide ${
            emphasized ? "text-zinc-300" : "text-zinc-600"
          }`}
        >
          {label}
        </p>
      </div>
      <p className="mt-2 font-mono text-2xl font-semibold tabular-nums">
        {formatRWF(value)}
      </p>
      <p className={`mt-1 text-xs ${emphasized ? "text-zinc-300" : tone}`}>
        {renderDelta(deltaStr)}
      </p>
    </div>
  );
}
