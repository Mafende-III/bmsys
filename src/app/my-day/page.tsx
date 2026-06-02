import Link from "next/link";
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
    <main className="mx-auto max-w-3xl p-4 sm:p-6">
      <header className="mb-4 flex items-center justify-between gap-3">
        <div>
          <Link
            href={session.role === "OWNER" ? "/dashboard" : "/sell"}
            className="text-sm text-zinc-600 hover:underline"
          >
            ← {t("back")}
          </Link>
          <h1 className="mt-1 text-2xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-zinc-600">
            {t("subtitle", { name: session.name ?? "" })}
          </p>
        </div>
      </header>

      {/* Hero cards: today — stack on tiny phones (320px), 3 cols sm+ */}
      <section
        data-tour="my-day-today"
        className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 sm:grid-cols-3"
      >
        <KpiCard
          icon={<ShoppingCart className="h-5 w-5" strokeWidth={1.75} />}
          label={t("salesToday")}
          value={String(data.today.salesCount)}
        />
        <KpiCard
          icon={<TrendingUp className="h-5 w-5" strokeWidth={1.75} />}
          label={t("totalToday")}
          value={formatRWF(data.today.total)}
          tone="dark"
        />
        <KpiCard
          icon={<Star className="h-5 w-5" strokeWidth={1.75} />}
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
      <section
        data-tour="my-day-trend"
        className="mt-6 rounded-2xl border border-zinc-200 bg-white p-4"
      >
        <div className="flex items-end justify-between gap-2">
          <div>
            <h2 className="text-base font-medium">{t("trendTitle")}</h2>
            <p className="mt-0.5 text-xs text-zinc-600">{t("trendSubtitle")}</p>
          </div>
          <div className="text-right text-xs text-zinc-600">
            <p>
              <span className="font-medium">{data.weekToDate.salesCount}</span>{" "}
              {t("salesShort")}
            </p>
            <p className="font-mono tabular-nums">
              {formatRWF(data.weekToDate.total)}
            </p>
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
                    className={`w-full rounded-t ${
                      isToday
                        ? "bg-zinc-900"
                        : d.total > 0
                          ? "bg-zinc-400"
                          : "bg-zinc-200"
                    }`}
                    style={{ height: `${Math.max(2, pct)}%` }}
                  />
                </div>
                <p
                  className={`text-[10px] ${
                    isToday ? "font-semibold text-zinc-900" : "text-zinc-500"
                  }`}
                >
                  {d.label}
                </p>
              </li>
            );
          })}
        </ol>

        {data.weekToDate.salesCount === 0 && (
          <p className="mt-4 text-center text-xs text-zinc-500">
            {t("noSalesYet")}
          </p>
        )}
      </section>

      {/* Stock to watch — status banner + full inventory list */}
      <section
        data-tour="my-day-stock"
        className="mt-6 rounded-2xl border border-zinc-200 bg-white p-4"
      >
        <h2 className="text-base font-medium">{t("stockTitle")}</h2>
        <p className="mt-0.5 text-xs text-zinc-600">{t("stockSubtitle")}</p>

        {outCount + lowCount === 0 ? (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
            <CheckCircle2 className="h-4 w-4 shrink-0" strokeWidth={2} />
            <span>{t("stockAllOk")}</span>
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs">
            {outCount > 0 && (
              <span className="inline-flex items-center gap-1 text-red-800">
                <PackageX className="h-3.5 w-3.5" strokeWidth={2} />
                {t("stockOutCount", { count: outCount })}
              </span>
            )}
            {lowCount > 0 && (
              <span className="inline-flex items-center gap-1 text-amber-900">
                <AlertTriangle className="h-3.5 w-3.5" strokeWidth={2} />
                {t("stockLowCount", { count: lowCount })}
              </span>
            )}
            <span className="ml-auto text-zinc-600">
              {t("stockTotalProducts", { count: stock.length })}
            </span>
          </div>
        )}

        <ul className="mt-3 divide-y divide-zinc-100 overflow-hidden rounded-lg border border-zinc-200">
          {stock.map((row) => {
            const tone =
              row.status === "out"
                ? "bg-red-100 text-red-800"
                : row.status === "low"
                  ? "bg-amber-100 text-amber-800"
                  : "bg-zinc-100 text-zinc-700";
            const Icon =
              row.status === "out"
                ? PackageX
                : row.status === "low"
                  ? AlertTriangle
                  : CheckCircle2;
            return (
              <li
                key={row.productId}
                className="flex items-center justify-between gap-3 bg-white px-3 py-2 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-zinc-800">
                    {row.name}
                  </p>
                  <p className="font-mono text-[10px] text-zinc-500">
                    {row.sku}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${tone}`}
                  >
                    <Icon className="h-3 w-3" strokeWidth={2.5} />
                    <span className="font-mono tabular-nums">{row.units}</span>
                  </span>
                  {row.status === "low" && row.threshold > 0 && (
                    <p className="mt-0.5 font-mono text-[10px] text-zinc-500">
                      {t("stockThreshold", { threshold: row.threshold })}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
          {stock.length === 0 && (
            <li className="bg-white px-3 py-6 text-center text-xs text-zinc-500">
              {t("stockEmpty")}
            </li>
          )}
        </ul>
      </section>

      <p className="mt-6 text-center text-xs text-zinc-500">{t("scopeNote")}</p>
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
  const cls =
    tone === "dark"
      ? "border-zinc-900 bg-zinc-900 text-white"
      : "border-zinc-200 bg-white text-zinc-900";
  return (
    <div
      className={`rounded-2xl border-2 p-4 ${cls} ${tone === "dark" ? "" : "shadow-sm"}`}
    >
      <div
        className={`flex items-center gap-1.5 text-xs uppercase tracking-wide ${
          tone === "dark" ? "text-zinc-300" : "text-zinc-500"
        }`}
      >
        {icon}
        <span>{label}</span>
      </div>
      <p className="mt-2 line-clamp-2 text-xl font-semibold tabular-nums">
        {value}
      </p>
      {sub && (
        <p
          className={`mt-1 text-xs ${
            tone === "dark" ? "text-zinc-300" : "text-zinc-500"
          }`}
        >
          {sub}
        </p>
      )}
    </div>
  );
}
