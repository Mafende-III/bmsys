import Link from "next/link";
import {
  AlertTriangle,
  Banknote,
  Download,
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
  getProductProfit,
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
import { CaptionLabel, Card } from "@/components/ui";
import { cn } from "@/lib/cn";
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

  const [kpis, daily, top, channels, expensesByCat, stock, productProfit] =
    await Promise.all([
      getOverviewKPIs(period),
      getSalesByDay(period),
      getTopProducts(period, 5),
      getChannelBreakdown(period),
      getExpenseBreakdown(period),
      getStockHealth(),
      getProductProfit(period),
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
    daily[0] ?? { date: new Date(), total: 0, profit: 0, count: 0 },
  );
  const minDay = daily
    .filter((d) => d.total > 0)
    .reduce<typeof daily[number] | null>(
      (m, d) => (m === null || d.total < m.total ? d : m),
      null,
    );

  const presetKeys = PERIOD_KEYS.filter((k) => k !== "custom");

  return (
    <main className="mx-auto max-w-5xl space-y-3 p-4">
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-ink">{t("title")}</h1>
          <p className="text-[13px] text-ink-2">{t("subtitle")}</p>
        </div>
        <Link
          href="/reports/register"
          className="flex h-11 shrink-0 items-center gap-2 rounded-full bg-surface px-4 text-[13px] font-bold text-primary ring-1 ring-inset ring-rule"
        >
          <Download className="h-4 w-4" strokeWidth={2.2} />
          {t("registerLink")}
        </Link>
      </header>

      {/* Period chips + custom range */}
      <div data-tour="analytics-period" className="space-y-2.5">
        <div className="flex flex-wrap gap-2">
          {presetKeys.map((k) => (
            <Link
              key={k}
              href={`/analytics?period=${k}`}
              className={cn(
                "rounded-full px-4 py-2 text-[13px]",
                periodKey === k
                  ? "bg-ink font-bold text-white"
                  : "bg-surface font-semibold text-ink-2 ring-1 ring-inset ring-rule",
              )}
            >
              {periodLabel[k]}
            </Link>
          ))}
        </div>
        <form method="get" className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="period" value="custom" />
          <input
            type="date"
            name="from"
            defaultValue={fromValue}
            aria-label={t("fromDate")}
            className="h-10 rounded-panel border border-rule bg-surface px-2.5 text-[13px] text-ink-2"
          />
          <span className="text-xs text-ink-2">→</span>
          <input
            type="date"
            name="to"
            defaultValue={toValue}
            aria-label={t("toDate")}
            className="h-10 rounded-panel border border-rule bg-surface px-2.5 text-[13px] text-ink-2"
          />
          <button
            type="submit"
            className={cn(
              "h-10 rounded-full px-4 text-[13px] font-bold",
              periodKey === "custom"
                ? "bg-ink text-white"
                : "bg-surface text-primary ring-1 ring-inset ring-rule",
            )}
          >
            {tc("filter")}
          </button>
        </form>
      </div>

      {/* KPI 2x2 */}
      <section
        data-tour="analytics-kpis"
        className="grid grid-cols-2 gap-2.5 lg:grid-cols-4"
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
      <Card data-tour="analytics-daily" className="p-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CaptionLabel>{t("salesByDay")}</CaptionLabel>
            <p className="mt-0.5 text-xs text-ink-2">{t("salesByDayHint")}</p>
          </div>
          <div className="text-xs text-ink-2">
            {maxDay.total > 0 && (
              <span className="mr-3">
                <span className="font-bold text-success">
                  {t("highestDay")}:
                </span>{" "}
                {maxDay.date.toLocaleDateString(undefined, {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                })}{" "}
                <span className="num font-semibold text-ink">
                  {formatRWF(maxDay.total)}
                </span>
              </span>
            )}
            {minDay && (
              <span>
                <span className="font-bold text-warning">
                  {t("lowestDay")}:
                </span>{" "}
                {minDay.date.toLocaleDateString(undefined, {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                })}{" "}
                <span className="num font-semibold text-ink">
                  {formatRWF(minDay.total)}
                </span>
              </span>
            )}
          </div>
        </div>
        {kpis.revenue === 0 ? (
          <div className="mt-6 flex flex-col items-center gap-2 py-8 text-center text-ink-2">
            <LineChart className="h-10 w-10 text-rule" strokeWidth={1.5} />
            <p className="text-sm font-semibold text-ink">{t("noSalesYet")}</p>
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
                profit: d.profit,
                count: d.count,
              }))}
            />
          </div>
        )}
      </Card>

      {/* Two-column: top products + channels */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Card className="p-4">
          <CaptionLabel>{t("topProducts")}</CaptionLabel>
          <p className="mt-0.5 text-xs text-ink-2">{t("topProductsHint")}</p>
          {top.length === 0 ? (
            <p className="mt-4 text-sm text-ink-2">{t("noData")}</p>
          ) : (
            <div className="mt-4">
              <TopSellersChart data={top} />
            </div>
          )}
        </Card>

        <Card className="p-4">
          <CaptionLabel>{t("channels")}</CaptionLabel>
          <p className="mt-0.5 text-xs text-ink-2">{t("channelsHint")}</p>
          {channels.length === 0 ? (
            <p className="mt-4 text-sm text-ink-2">{t("noData")}</p>
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
        </Card>
      </div>

      {/* Profit by product */}
      <Card data-tour="analytics-profit" className="overflow-hidden">
        <div className="p-4 pb-0">
          <CaptionLabel>{t("profitByProduct")}</CaptionLabel>
          <p className="mt-0.5 text-xs text-ink-2">
            {t("profitByProductHint")}
          </p>
        </div>
        {productProfit.length === 0 ? (
          <p className="p-4 text-sm text-ink-2">{t("noData")}</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-ground text-[11px] font-semibold uppercase tracking-wide text-ink-2">
                <tr>
                  <th className="px-4 py-2 text-left">
                    {t("profitColProduct")}
                  </th>
                  <th className="px-3 py-2 text-right">
                    {t("profitColUnits")}
                  </th>
                  <th className="px-3 py-2 text-right">
                    {t("profitColRevenue")}
                  </th>
                  <th className="px-3 py-2 text-right">{t("profitColCost")}</th>
                  <th className="px-3 py-2 text-right">
                    {t("profitColProfit")}
                  </th>
                  <th className="px-4 py-2 text-right">
                    {t("profitColMargin")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule-hair">
                {productProfit.map((p) => {
                  const marginPct = p.marginBps / 100;
                  const marginTone =
                    marginPct >= 15
                      ? "bg-success-wash text-success"
                      : marginPct >= 5
                        ? "bg-warning-wash text-warning"
                        : "bg-error-wash text-error";
                  return (
                    <tr key={p.productId}>
                      <td className="px-4 py-2.5">
                        <p className="font-bold text-ink">{p.name}</p>
                        <p className="num text-[10px] text-ink-2">{p.sku}</p>
                      </td>
                      <td className="num px-3 py-2.5 text-right text-ink-2">
                        {p.unitsSold}
                      </td>
                      <td className="num px-3 py-2.5 text-right text-ink-2">
                        {formatRWF(p.revenue)}
                      </td>
                      <td className="num px-3 py-2.5 text-right text-ink-2">
                        {formatRWF(p.cost)}
                      </td>
                      <td
                        className={cn(
                          "num px-3 py-2.5 text-right font-bold",
                          p.profit >= 0 ? "text-success" : "text-error",
                        )}
                      >
                        {formatRWF(p.profit)}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span
                          className={cn(
                            "num inline-block rounded-full px-2.5 py-1 text-xs font-bold",
                            marginTone,
                          )}
                        >
                          {marginPct.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Two-column: stock health + expenses */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Card data-tour="analytics-stock" className="p-4">
          <CaptionLabel>{t("stockHealth")}</CaptionLabel>
          <dl className="mt-3 grid grid-cols-2 gap-2.5 text-sm">
            <div className="rounded-sheet bg-ground p-3">
              <dt className="text-xs text-ink-2">{t("stockValue")}</dt>
              <dd className="num mt-1 text-lg font-bold text-ink">
                {formatRWF(stock.totalStockValue)}
              </dd>
              <dd className="mt-0.5 text-[10px] text-ink-2">
                {t("stockValueNote")}
              </dd>
            </div>
            <div
              className={cn(
                "rounded-sheet p-3",
                stock.outOfStock.length > 0 ? "bg-error-wash" : "bg-ground",
              )}
            >
              <dt
                className={cn(
                  "flex items-center gap-1 text-xs font-semibold",
                  stock.outOfStock.length > 0 ? "text-error" : "text-ink-2",
                )}
              >
                <PackageX className="h-3 w-3" />{" "}
                {t("outOfStockCount", { count: stock.outOfStock.length })}
              </dt>
              {stock.outOfStock.length > 0 && (
                <dd className="mt-1 text-xs text-error">
                  {stock.outOfStock
                    .slice(0, 3)
                    .map((p) => p.name)
                    .join(", ")}
                  {stock.outOfStock.length > 3 && "…"}
                </dd>
              )}
            </div>
            <div
              className={cn(
                "col-span-2 rounded-sheet p-3",
                stock.lowStock.length > 0 ? "bg-warning-wash" : "bg-ground",
              )}
            >
              <dt
                className={cn(
                  "flex items-center gap-1 text-xs font-semibold",
                  stock.lowStock.length > 0 ? "text-warning" : "text-ink-2",
                )}
              >
                <AlertTriangle className="h-3 w-3" />{" "}
                {t("lowStockCount", { count: stock.lowStock.length })}
              </dt>
              {stock.lowStock.length > 0 && (
                <dd className="mt-2 space-y-1">
                  {stock.lowStock.slice(0, 5).map((p) => (
                    <div
                      key={p.productId}
                      className="flex items-center justify-between text-xs text-warning"
                    >
                      <span className="truncate">{p.name}</span>
                      <span className="num font-semibold">
                        {p.units}/{p.threshold}
                      </span>
                    </div>
                  ))}
                  {stock.lowStock.length > 5 && (
                    <Link
                      href="/products?stock=low"
                      className="text-xs font-bold text-warning underline"
                    >
                      {t("viewAll")} →
                    </Link>
                  )}
                </dd>
              )}
            </div>
          </dl>
        </Card>

        <Card className="p-4">
          <CaptionLabel>{t("expenses")}</CaptionLabel>
          <p className="mt-0.5 text-xs text-ink-2">{t("expensesHint")}</p>
          {expensesByCat.length === 0 ? (
            <p className="mt-4 text-sm text-ink-2">{t("noData")}</p>
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
        </Card>
      </div>

      <p className="pb-2 text-xs italic text-ink-2">{t("currentCostNote")}</p>
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
  const tone =
    delta === 0 ? "text-ink-2" : positive ? "text-success" : "text-error";
  const arrow = delta === 0 ? "·" : delta > 0 ? "▲" : "▼";
  const deltaStr =
    pct === null
      ? `${arrow} ${formatRWF(Math.abs(delta))}`
      : `${arrow} ${Math.abs(pct)}%`;

  return (
    <div
      className={cn(
        "rounded-card p-4 ring-1 ring-inset",
        emphasized
          ? "bg-success-wash ring-[#bbe7c8]"
          : "bg-surface ring-rule-hair",
      )}
    >
      <div className="flex items-center gap-1.5">
        <Icon
          className={cn(
            "h-3.5 w-3.5",
            emphasized ? "text-success" : "text-ink-2",
          )}
          strokeWidth={2}
        />
        <CaptionLabel className={emphasized ? "text-success" : undefined}>
          {label}
        </CaptionLabel>
      </div>
      <p
        className={cn(
          "num mt-2 text-xl font-bold",
          emphasized ? "text-success" : "text-ink",
        )}
      >
        {formatRWF(value)}
      </p>
      <p className={cn("num mt-1 text-xs font-semibold", tone)}>
        {renderDelta(deltaStr)}
      </p>
    </div>
  );
}
