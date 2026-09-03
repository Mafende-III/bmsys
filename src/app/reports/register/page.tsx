import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Table2 } from "lucide-react";
import { requireOwner } from "@/lib/auth-guards";
import { getRegisterReport } from "@/lib/reports/register";
import { formatRWF } from "@/lib/format";
import { CsvButton } from "./_components/CsvButton";

export const dynamic = "force-dynamic";

type SearchParams = { from?: string; to?: string };

function parseDateParam(v: string | undefined): Date | null {
  if (!v) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function csvEscape(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(header: string[], rows: (string | number)[][]): string {
  return [
    header.map(csvEscape).join(","),
    ...rows.map((r) => r.map(csvEscape).join(",")),
  ].join("\n");
}

function fmtDateTime(d: Date): string {
  return new Date(d).toLocaleString("en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function RegisterReportPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireOwner();
  const sp = await searchParams;

  // Default: this calendar month.
  const now = new Date();
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1);
  const from = parseDateParam(sp.from) ?? defaultFrom;
  const toRaw = parseDateParam(sp.to) ?? now;
  const to = new Date(toRaw);
  to.setHours(23, 59, 59, 999);

  const report = await getRegisterReport(from, to);
  const t = await getTranslations("register");
  const tc = await getTranslations("common");

  const rangeSlug = `${toYmd(from)}_${toYmd(to)}`;

  const salesCsv = toCsv(
    [
      "Date",
      "Sale ID",
      "Channel",
      "Payment",
      "Seller",
      "SKU",
      "Product",
      "Sold as",
      "Qty",
      "Units",
      "Unit price (RWF)",
      "Gross (RWF)",
      "Discount (RWF)",
      "Net (RWF)",
      "Cost (RWF)",
      "Profit (RWF)",
    ],
    report.sales.map((r) => [
      fmtDateTime(r.date),
      r.saleId,
      r.channelName,
      r.paymentMethod,
      r.sellerName,
      r.sku,
      r.productName,
      r.saleUnit,
      r.qty,
      r.units,
      r.unitPrice,
      r.gross,
      r.discount,
      r.net,
      r.cost,
      r.profit,
    ]),
  );

  const purchasesCsv = toCsv(
    [
      "Date",
      "Purchase ID",
      "Supplier",
      "SKU",
      "Product",
      "Cartons",
      "Loose units",
      "Units",
      "Cost per carton (RWF)",
      "Line total (RWF)",
    ],
    report.purchases.map((r) => [
      fmtDateTime(r.date),
      r.purchaseId,
      r.supplierName,
      r.sku,
      r.productName,
      r.qtyCartons,
      r.qtyLooseUnits,
      r.units,
      r.costPerCarton,
      r.lineTotal,
    ]),
  );

  const summaryCsv = toCsv(
    [
      "SKU",
      "Product",
      "Units purchased",
      "Purchase cost (RWF)",
      "Units sold",
      "Sales revenue (RWF)",
      "Cost of sales (RWF)",
      "Profit (RWF)",
    ],
    report.products.map((r) => [
      r.sku,
      r.productName,
      r.purchasedUnits,
      r.purchaseCost,
      r.soldUnits,
      r.salesRevenue,
      r.salesCost,
      r.profit,
    ]),
  );

  const thCls = "px-3 py-2 text-right font-medium whitespace-nowrap";
  const tdNum = "px-3 py-2 text-right font-mono tabular-nums whitespace-nowrap";

  return (
    <main className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6">
      <header>
        <Link href="/reports" className="text-sm text-zinc-600 hover:underline">
          ← {t("backToReports")}
        </Link>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold">
          <Table2 className="h-6 w-6" strokeWidth={2} />
          {t("title")}
        </h1>
        <p className="text-sm text-zinc-600">{t("subtitle")}</p>
      </header>

      {/* Date filter */}
      <form
        method="get"
        data-tour="register-filters"
        className="flex flex-wrap items-end gap-2 rounded-2xl border border-zinc-200 bg-white p-3"
      >
        <label className="block text-xs">
          <span className="text-zinc-600">{t("filterFrom")}</span>
          <input
            type="date"
            name="from"
            defaultValue={toYmd(from)}
            className="mt-0.5 block rounded-lg border border-zinc-300 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="block text-xs">
          <span className="text-zinc-600">{t("filterTo")}</span>
          <input
            type="date"
            name="to"
            defaultValue={toYmd(toRaw)}
            className="mt-0.5 block rounded-lg border border-zinc-300 px-2 py-1.5 text-sm"
          />
        </label>
        <button
          type="submit"
          className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800"
        >
          {t("filterApply")}
        </button>
      </form>

      {/* ── Product summary ─────────────────────────────────────────── */}
      <section
        data-tour="register-summary"
        className="overflow-hidden rounded-2xl border border-zinc-200 bg-white"
      >
        <div className="flex items-center justify-between gap-2 p-4 pb-2">
          <div>
            <h2 className="text-base font-medium">{t("summaryTitle")}</h2>
            <p className="mt-0.5 text-xs text-zinc-600">{t("summaryHint")}</p>
          </div>
          <CsvButton
            csv={summaryCsv}
            filename={`product-summary_${rangeSlug}.csv`}
            label={t("downloadCsv")}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-xs text-zinc-600">
              <tr>
                <th className="px-4 py-2 text-left font-medium">
                  {t("colProduct")}
                </th>
                <th className={thCls}>{t("colPurchasedUnits")}</th>
                <th className={thCls}>{t("colPurchaseCost")}</th>
                <th className={thCls}>{t("colSoldUnits")}</th>
                <th className={thCls}>{t("colRevenue")}</th>
                <th className={thCls}>{t("colCostOfSales")}</th>
                <th className={`${thCls} pr-4`}>{t("colProfit")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {report.products.map((r) => (
                <tr key={r.sku}>
                  <td className="px-4 py-2">
                    <p className="font-medium text-zinc-800">{r.productName}</p>
                    <p className="font-mono text-[10px] text-zinc-500">
                      {r.sku}
                    </p>
                  </td>
                  <td className={tdNum}>{r.purchasedUnits}</td>
                  <td className={tdNum}>{formatRWF(r.purchaseCost)}</td>
                  <td className={tdNum}>{r.soldUnits}</td>
                  <td className={tdNum}>{formatRWF(r.salesRevenue)}</td>
                  <td className={`${tdNum} text-zinc-500`}>
                    {formatRWF(r.salesCost)}
                  </td>
                  <td
                    className={`${tdNum} pr-4 font-semibold ${
                      r.profit >= 0 ? "text-green-700" : "text-red-700"
                    }`}
                  >
                    {formatRWF(r.profit)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-zinc-200 bg-zinc-50 font-medium">
              <tr>
                <td className="px-4 py-2">{t("totalsRow")}</td>
                <td className={tdNum}>{report.totals.purchases.units}</td>
                <td className={tdNum}>
                  {formatRWF(report.totals.purchases.cost)}
                </td>
                <td className={tdNum}>{report.totals.sales.units}</td>
                <td className={tdNum}>{formatRWF(report.totals.sales.net)}</td>
                <td className={`${tdNum} text-zinc-500`}>
                  {formatRWF(report.totals.sales.cost)}
                </td>
                <td
                  className={`${tdNum} pr-4 font-semibold ${
                    report.totals.sales.profit >= 0
                      ? "text-green-700"
                      : "text-red-700"
                  }`}
                >
                  {formatRWF(report.totals.sales.profit)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {/* ── Sales register ──────────────────────────────────────────── */}
      <section
        data-tour="register-sales"
        className="overflow-hidden rounded-2xl border border-zinc-200 bg-white"
      >
        <div className="flex items-center justify-between gap-2 p-4 pb-2">
          <div>
            <h2 className="text-base font-medium">{t("salesTitle")}</h2>
            <p className="mt-0.5 text-xs text-zinc-600">
              {t("salesHint", { count: report.totals.sales.lines })}
            </p>
          </div>
          <CsvButton
            csv={salesCsv}
            filename={`sales-register_${rangeSlug}.csv`}
            label={t("downloadCsv")}
          />
        </div>
        {report.sales.length === 0 ? (
          <p className="px-4 pb-4 text-sm text-zinc-500">{t("noData")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-xs text-zinc-600">
                <tr>
                  <th className="px-4 py-2 text-left font-medium whitespace-nowrap">
                    {t("colDate")}
                  </th>
                  <th className="px-3 py-2 text-left font-medium">
                    {t("colProduct")}
                  </th>
                  <th className="px-3 py-2 text-left font-medium">
                    {t("colChannel")}
                  </th>
                  <th className={thCls}>{t("colQty")}</th>
                  <th className={thCls}>{t("colUnits")}</th>
                  <th className={thCls}>{t("colUnitPrice")}</th>
                  <th className={thCls}>{t("colDiscount")}</th>
                  <th className={thCls}>{t("colNet")}</th>
                  <th className={thCls}>{t("colCost")}</th>
                  <th className={`${thCls} pr-4`}>{t("colProfit")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {report.sales.map((r, i) => (
                  <tr key={`${r.saleId}-${i}`}>
                    <td className="px-4 py-2 whitespace-nowrap text-zinc-700">
                      {fmtDateTime(r.date)}
                    </td>
                    <td className="px-3 py-2">
                      <p className="text-zinc-800">{r.productName}</p>
                      <p className="font-mono text-[10px] text-zinc-500">
                        {r.sku} · {r.saleUnit === "CARTON" ? t("unitCarton") : t("unitSingle")}
                      </p>
                    </td>
                    <td className="px-3 py-2 text-zinc-600 whitespace-nowrap">
                      {r.channelName} · {r.paymentMethod}
                    </td>
                    <td className={tdNum}>{r.qty}</td>
                    <td className={tdNum}>{r.units}</td>
                    <td className={tdNum}>{formatRWF(r.unitPrice)}</td>
                    <td className={`${tdNum} text-amber-700`}>
                      {r.discount > 0 ? `−${formatRWF(r.discount)}` : "—"}
                    </td>
                    <td className={tdNum}>{formatRWF(r.net)}</td>
                    <td className={`${tdNum} text-zinc-500`}>
                      {formatRWF(r.cost)}
                    </td>
                    <td
                      className={`${tdNum} pr-4 font-semibold ${
                        r.profit >= 0 ? "text-green-700" : "text-red-700"
                      }`}
                    >
                      {formatRWF(r.profit)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-zinc-200 bg-zinc-50 font-medium">
                <tr>
                  <td colSpan={3} className="px-4 py-2">
                    {t("totalsRow")}
                  </td>
                  <td className={tdNum}>—</td>
                  <td className={tdNum}>{report.totals.sales.units}</td>
                  <td className={tdNum}>—</td>
                  <td className={`${tdNum} text-amber-700`}>
                    {report.totals.sales.discount > 0
                      ? `−${formatRWF(report.totals.sales.discount)}`
                      : "—"}
                  </td>
                  <td className={tdNum}>
                    {formatRWF(report.totals.sales.net)}
                  </td>
                  <td className={`${tdNum} text-zinc-500`}>
                    {formatRWF(report.totals.sales.cost)}
                  </td>
                  <td
                    className={`${tdNum} pr-4 font-semibold ${
                      report.totals.sales.profit >= 0
                        ? "text-green-700"
                        : "text-red-700"
                    }`}
                  >
                    {formatRWF(report.totals.sales.profit)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      {/* ── Purchase register ───────────────────────────────────────── */}
      <section
        data-tour="register-purchases"
        className="overflow-hidden rounded-2xl border border-zinc-200 bg-white"
      >
        <div className="flex items-center justify-between gap-2 p-4 pb-2">
          <div>
            <h2 className="text-base font-medium">{t("purchasesTitle")}</h2>
            <p className="mt-0.5 text-xs text-zinc-600">
              {t("purchasesHint", { count: report.totals.purchases.lines })}
            </p>
          </div>
          <CsvButton
            csv={purchasesCsv}
            filename={`purchase-register_${rangeSlug}.csv`}
            label={t("downloadCsv")}
          />
        </div>
        {report.purchases.length === 0 ? (
          <p className="px-4 pb-4 text-sm text-zinc-500">{t("noData")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-xs text-zinc-600">
                <tr>
                  <th className="px-4 py-2 text-left font-medium whitespace-nowrap">
                    {t("colDate")}
                  </th>
                  <th className="px-3 py-2 text-left font-medium">
                    {t("colSupplier")}
                  </th>
                  <th className="px-3 py-2 text-left font-medium">
                    {t("colProduct")}
                  </th>
                  <th className={thCls}>{t("colCartons")}</th>
                  <th className={thCls}>{t("colLoose")}</th>
                  <th className={thCls}>{t("colUnits")}</th>
                  <th className={thCls}>{t("colCostPerCarton")}</th>
                  <th className={`${thCls} pr-4`}>{t("colLineTotal")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {report.purchases.map((r, i) => (
                  <tr key={`${r.purchaseId}-${i}`}>
                    <td className="px-4 py-2 whitespace-nowrap text-zinc-700">
                      {fmtDateTime(r.date)}
                    </td>
                    <td className="px-3 py-2 text-zinc-600">
                      {r.supplierName}
                    </td>
                    <td className="px-3 py-2">
                      <p className="text-zinc-800">{r.productName}</p>
                      <p className="font-mono text-[10px] text-zinc-500">
                        {r.sku}
                      </p>
                    </td>
                    <td className={tdNum}>{r.qtyCartons}</td>
                    <td className={tdNum}>{r.qtyLooseUnits}</td>
                    <td className={tdNum}>{r.units}</td>
                    <td className={tdNum}>{formatRWF(r.costPerCarton)}</td>
                    <td className={`${tdNum} pr-4 font-semibold`}>
                      {formatRWF(r.lineTotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-zinc-200 bg-zinc-50 font-medium">
                <tr>
                  <td colSpan={5} className="px-4 py-2">
                    {t("totalsRow")}
                  </td>
                  <td className={tdNum}>{report.totals.purchases.units}</td>
                  <td className={tdNum}>—</td>
                  <td className={`${tdNum} pr-4 font-semibold`}>
                    {formatRWF(report.totals.purchases.cost)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      <p className="text-center text-xs text-zinc-500">{t("scopeNote")}</p>
    </main>
  );
}
