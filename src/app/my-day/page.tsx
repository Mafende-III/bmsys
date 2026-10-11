import {
  AlertTriangle,
  CheckCircle2,
  PackageX,
  ShoppingCart,
  Star,
  TrendingUp,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireSeller } from "@/lib/auth-guards";
import { getStockList } from "@/lib/analytics/queries";
import { getMyDay } from "@/lib/sales/my-day";
import { formatRWF } from "@/lib/format";
import { Card, CaptionLabel, StatusPill } from "@/components/ui";
import { cn } from "@/lib/cn";

export const dynamic = "force-dynamic";

export default async function MyDayPage() {
  const session = await requireSeller();
  const [data, stock] = await Promise.all([
    getMyDay(session.id),
    getStockList(),
  ]);
  const t = await getTranslations("myDay");

  const dailyMax = Math.max(...data.daily.map((d) => d.total), 1);
  const todayKey = data.today.date.toISOString().slice(0, 10);
  const outCount = stock.filter((s) => s.status === "out").length;
  const lowCount = stock.filter((s) => s.status === "low").length;

  return (
    <main className="mx-auto max-w-2xl space-y-3 p-4">
      <header>
        <h1 className="text-xl font-bold text-ink">{t("title")}</h1>
        <p className="text-[13px] text-ink-2">
          {t("subtitle", { name: session.name ?? "" })}
        </p>
      </header>

      {/* Hero cards: today — stack on tiny phones (320px), 3 cols sm+ */}
      <section
        data-tour="my-day-today"
        className="grid grid-cols-1 gap-2.5 min-[420px]:grid-cols-2 sm:grid-cols-3"
      >
        <KpiCard
          icon={<ShoppingCart className="h-3.5 w-3.5" strokeWidth={2} />}
          label={t("salesToday")}
          value={String(data.today.salesCount)}
        />
        <KpiCard
          icon={<TrendingUp className="h-3.5 w-3.5" strokeWidth={2} />}
          label={t("totalToday")}
          value={formatRWF(data.today.total)}
          tone="dark"
        />
        <KpiCard
          icon={<Star className="h-3.5 w-3.5" strokeWidth={2} />}
          label={t("topItem")}
          value={data.topProductToday?.name ?? t("noTopItem")}
          sub={
            data.topProductToday
              ? t("topItemSub", { units: data.topProductToday.unitsSold })
              : ""
          }
        />
      </section>

      {/* 7-day mini trend */}
      <Card data-tour="my-day-trend" className="p-4">
        <div className="flex items-end justify-between gap-2">
          <div>
            <CaptionLabel>{t("trendTitle")}</CaptionLabel>
            <p className="mt-0.5 text-xs text-ink-2">{t("trendSubtitle")}</p>
          </div>
          <div className="text-right text-xs text-ink-2">
            <p>
              <span className="num font-bold text-ink">
                {data.weekToDate.salesCount}
              </span>{" "}
              {t("salesShort")}
            </p>
            <p className="num">{formatRWF(data.weekToDate.total)}</p>
          </div>
        </div>

        <ol className="mt-4 grid grid-cols-7 gap-1.5">
          {data.daily.map((d) => {
            const pct = (d.total / dailyMax) * 100;
            const isToday = d.iso === todayKey;
            return (
              <li
                key={d.iso}
                className="flex flex-col items-center gap-1"
                title={`${d.label} — ${formatRWF(d.total)}, ${d.count} ${
                  d.count === 1 ? "sale" : "sales"
                }`}
              >
                <div className="flex h-24 w-full items-end">
                  <div
                    className={cn(
                      "w-full rounded-t",
                      isToday
                        ? "bg-ink"
                        : d.total > 0
                          ? "bg-[rgba(13,27,42,0.35)]"
                          : "bg-surface-sunk",
                    )}
                    style={{ height: `${Math.max(2, pct)}%` }}
                  />
                </div>
                <p
                  className={cn(
                    "text-[10px]",
                    isToday ? "font-bold text-ink" : "text-ink-2",
                  )}
                >
                  {d.label}
                </p>
              </li>
            );
          })}
        </ol>

        {data.weekToDate.salesCount === 0 && (
          <p className="mt-4 text-center text-xs text-ink-2">
            {t("noSalesYet")}
          </p>
        )}
      </Card>

      {/* Stock to watch — status banner + full inventory list */}
      <Card data-tour="my-day-stock" className="p-4">
        <CaptionLabel>{t("stockTitle")}</CaptionLabel>
        <p className="mt-0.5 text-xs text-ink-2">{t("stockSubtitle")}</p>

        {outCount + lowCount === 0 ? (
          <div className="mt-3 flex items-center gap-2 rounded-panel bg-success-wash px-3.5 py-2.5 text-sm font-semibold text-success">
            <CheckCircle2 className="h-4 w-4 shrink-0" strokeWidth={2.2} />
            <span>{t("stockAllOk")}</span>
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-panel bg-warning-wash px-3.5 py-2.5 text-xs font-semibold">
            {outCount > 0 && (
              <span className="inline-flex items-center gap-1 text-error">
                <PackageX className="h-3.5 w-3.5" strokeWidth={2.2} />
                {t("stockOutCount", { count: outCount })}
              </span>
            )}
            {lowCount > 0 && (
              <span className="inline-flex items-center gap-1 text-warning">
                <AlertTriangle className="h-3.5 w-3.5" strokeWidth={2.2} />
                {t("stockLowCount", { count: lowCount })}
              </span>
            )}
            <span className="ml-auto text-ink-2">
              {t("stockTotalProducts", { count: stock.length })}
            </span>
          </div>
        )}

        <ul className="mt-3 overflow-hidden rounded-panel ring-1 ring-inset ring-rule-hair">
          {stock.map((row, i) => {
            const tone =
              row.status === "out"
                ? "error"
                : row.status === "low"
                  ? "warning"
                  : "neutral";
            const Icon =
              row.status === "out"
                ? PackageX
                : row.status === "low"
                  ? AlertTriangle
                  : CheckCircle2;
            return (
              <li
                key={row.productId}
                className={cn(
                  "flex items-center justify-between gap-3 px-3 py-2 text-sm",
                  i > 0 && "border-t border-rule-hair",
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-ink">{row.name}</p>
                  <p className="num text-[10px] text-ink-2">{row.sku}</p>
                </div>
                <div className="shrink-0 text-right">
                  <StatusPill
                    tone={tone}
                    icon={<Icon className="h-3 w-3" strokeWidth={2.5} />}
                  >
                    <span className="num">{row.units}</span>
                  </StatusPill>
                  {row.status === "low" && row.threshold > 0 && (
                    <p className="num mt-0.5 text-[10px] text-ink-2">
                      {t("stockThreshold", { threshold: row.threshold })}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
          {stock.length === 0 && (
            <li className="px-3 py-6 text-center text-xs text-ink-2">
              {t("stockEmpty")}
            </li>
          )}
        </ul>
      </Card>

      <p className="text-center text-xs text-ink-2">{t("scopeNote")}</p>
    </main>
  );
}

function KpiCard({
  icon,
  label,
  value,
  sub,
  tone = "light",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  tone?: "light" | "dark";
}) {
  const emphasized = tone === "dark";
  return (
    <div
      className={cn(
        "rounded-card p-4 ring-1 ring-inset",
        emphasized
          ? "bg-success-wash ring-[#bbe7c8]"
          : "bg-surface ring-rule-hair",
      )}
    >
      <div
        className={cn(
          "flex items-center gap-1.5",
          emphasized ? "text-success" : "text-ink-2",
        )}
      >
        {icon}
        <CaptionLabel className={emphasized ? "text-success" : undefined}>
          {label}
        </CaptionLabel>
      </div>
      <p
        className={cn(
          "num mt-2 line-clamp-2 text-xl font-bold",
          emphasized ? "text-success" : "text-ink",
        )}
      >
        {value}
      </p>
      {sub && (
        <p
          className={cn(
            "mt-1 text-xs",
            emphasized ? "text-success" : "text-ink-2",
          )}
        >
          {sub}
        </p>
      )}
    </div>
  );
}
