import { getTranslations } from "next-intl/server";
import { requireOwner } from "@/lib/auth-guards";
import { getRegisterReport } from "@/lib/reports/register";
import { formatRWF } from "@/lib/format";
import { Card, CaptionLabel } from "@/components/ui";
import { cn } from "@/lib/cn";
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

  const thCls = "px-3 py-2 text-right font-semibold whitespace-nowrap";
  const tdNum = "num px-3 py-2 text-right whitespace-nowrap";

  return (
    <main className="mx-auto max-w-5xl space-y-3 p-4">
      <header>
        <h1 className="text-xl font-bold text-ink">{t("title")}</h1>
        <p className="text-[13px] text-ink-2">{t("subtitle")}</p>
      </header>

      {/* Date filter */}
      <form
        method="get"
        data-tour="register-filters"
        className="flex flex-wrap items-end gap-2"
      >
        <label className="block">
          <CaptionLabel>{t("filterFrom")}</CaptionLabel>
          <input
            type="date"
            name="from"
            defaultValue={toYmd(from)}
            className="mt-0.5 block h-10 rounded-panel border border-rule bg-surface px-2.5 text-[13px] text-ink-2"
          />
        </label>
        <label className="block">
          <CaptionLabel>{t("filterTo")}</CaptionLabel>
          <input
            type="date"
            name="to"
            defaultValue={toYmd(toRaw)}
            className="mt-0.5 block h-10 rounded-panel border border-rule bg-surface px-2.5 text-[13px] text-ink-2"
          />
        </label>
        <button
          type="submit"
          className="h-10 rounded-full bg-surface px-4 text-[13px] font-bold text-primary ring-1 ring-inset ring-rule"
        >
          {t("filterApply")}
        </button>
      </form>

      {/* ── Product summary ─────────────────────────────────────────── */}
      <Card data-tour="register-summary" className="overflow-hidden">
        <div className="flex items-center justify-between gap-2 p-4 pb-2">
          <div>
            <CaptionLabel>{t("summaryTitle")}</CaptionLabel>
            <p className="mt-0.5 text-xs text-ink-2">{t("summaryHint")}</p>
          </div>
          <CsvButton
            csv={summaryCsv}
            filename={`product-summary_${rangeSlug}.csv`}
            label={t("downloadCsv")}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-ground text-[11px] uppercase tracking-wide text-ink-2">
              <tr>
                <th className="px-4 py-2 text-left font-semibold">
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
            <tbody>
              {report.products.map((r, i) => (
                <tr key={r.sku} className={cn(i > 0 && "border-t border-rule-hair")}>
                  <td className="px-4 py-2">
                    <p className="font-bold text-ink">{r.productName}</p>
                    <p className="num text-[10px] text-ink-2">{r.sku}</p>
                  </td>
                  <td className={cn(tdNum, "text-ink-2")}>{r.purchasedUnits}</td>
                  <td className={cn(tdNum, "text-ink")}>
                    {formatRWF(r.purchaseCost)}
                  </td>
                  <td className={cn(tdNum, "text-ink-2")}>{r.soldUnits}</td>
                  <td className={cn(tdNum, "text-ink")}>
                    {formatRWF(r.salesRevenue)}
                  </td>
                  <td className={cn(tdNum, "text-ink-2")}>
                    {formatRWF(r.salesCost)}
                  </td>
                  <td
                    className={cn(
                      tdNum,
                      "pr-4 font-bold",
                      r.profit >= 0 ? "text-success" : "text-error",
                    )}
                  >
                    {formatRWF(r.profit)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-rule bg-ground font-semibold">
              <tr>
                <td className="px-4 py-2 text-ink">{t("totalsRow")}</td>
                <td className={cn(tdNum, "text-ink")}>
                  {report.totals.purchases.units}
                </td>
                <td className={cn(tdNum, "text-ink")}>
                  {formatRWF(report.totals.purchases.cost)}
                </td>
                <td className={cn(tdNum, "text-ink")}>
                  {report.totals.sales.units}
                </td>
                <td className={cn(tdNum, "text-ink")}>
                  {formatRWF(report.totals.sales.net)}
                </td>
                <td className={cn(tdNum, "text-ink-2")}>
                  {formatRWF(report.totals.sales.cost)}
                </td>
                <td
                  className={cn(
                    tdNum,
                    "pr-4 font-bold",
                    report.totals.sales.profit >= 0
                      ? "text-success"
                      : "text-error",
                  )}
                >
                  {formatRWF(report.totals.sales.profit)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      {/* ── Sales register ──────────────────────────────────────────── */}
      <Card data-tour="register-sales" className="overflow-hidden">
        <div className="flex items-center justify-between gap-2 p-4 pb-2">
          <div>
            <CaptionLabel>{t("salesTitle")}</CaptionLabel>
            <p className="mt-0.5 text-xs text-ink-2">
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
          <p className="px-4 pb-4 text-sm text-ink-2">{t("noData")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-ground text-[11px] uppercase tracking-wide text-ink-2">
                <tr>
                  <th className="whitespace-nowrap px-4 py-2 text-left font-semibold">
                    {t("colDate")}
                  </th>
                  <th className="px-3 py-2 text-left font-semibold">
                    {t("colProduct")}
                  </th>
                  <th className="px-3 py-2 text-left font-semibold">
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
              <tbody>
                {report.sales.map((r, i) => (
                  <tr
                    key={`${r.saleId}-${i}`}
                    className={cn(i > 0 && "border-t border-rule-hair")}
                  >
                    <td className="num whitespace-nowrap px-4 py-2 text-ink-2">
                      {fmtDateTime(r.date)}
                    </td>
                    <td className="px-3 py-2">
                      <p className="font-semibold text-ink">{r.productName}</p>
                      <p className="num text-[10px] text-ink-2">
                        {r.sku} ·{" "}
                        {r.saleUnit === "CARTON"
                          ? t("unitCarton")
                          : t("unitSingle")}
                      </p>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-ink-2">
                      {r.channelName} · {r.paymentMethod}
                    </td>
                    <td className={cn(tdNum, "text-ink-2")}>{r.qty}</td>
                    <td className={cn(tdNum, "text-ink-2")}>{r.units}</td>
                    <td className={cn(tdNum, "text-ink")}>
                      {formatRWF(r.unitPrice)}
                    </td>
                    <td className={cn(tdNum, "text-warning")}>
                      {r.discount > 0 ? `−${formatRWF(r.discount)}` : "—"}
                    </td>
                    <td className={cn(tdNum, "text-ink")}>
                      {formatRWF(r.net)}
                    </td>
                    <td className={cn(tdNum, "text-ink-2")}>
                      {formatRWF(r.cost)}
                    </td>
                    <td
                      className={cn(
                        tdNum,
                        "pr-4 font-bold",
                        r.profit >= 0 ? "text-success" : "text-error",
                      )}
                    >
                      {formatRWF(r.profit)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-rule bg-ground font-semibold">
                <tr>
                  <td colSpan={3} className="px-4 py-2 text-ink">
                    {t("totalsRow")}
                  </td>
                  <td className={cn(tdNum, "text-ink-2")}>—</td>
                  <td className={cn(tdNum, "text-ink")}>
                    {report.totals.sales.units}
                  </td>
                  <td className={cn(tdNum, "text-ink-2")}>—</td>
                  <td className={cn(tdNum, "text-warning")}>
                    {report.totals.sales.discount > 0
                      ? `−${formatRWF(report.totals.sales.discount)}`
                      : "—"}
                  </td>
                  <td className={cn(tdNum, "text-ink")}>
                    {formatRWF(report.totals.sales.net)}
                  </td>
                  <td className={cn(tdNum, "text-ink-2")}>
                    {formatRWF(report.totals.sales.cost)}
                  </td>
                  <td
                    className={cn(
                      tdNum,
                      "pr-4 font-bold",
                      report.totals.sales.profit >= 0
                        ? "text-success"
                        : "text-error",
                    )}
                  >
                    {formatRWF(report.totals.sales.profit)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      {/* ── Purchase register ───────────────────────────────────────── */}
      <Card data-tour="register-purchases" className="overflow-hidden">
        <div className="flex items-center justify-between gap-2 p-4 pb-2">
          <div>
            <CaptionLabel>{t("purchasesTitle")}</CaptionLabel>
            <p className="mt-0.5 text-xs text-ink-2">
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
          <p className="px-4 pb-4 text-sm text-ink-2">{t("noData")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-ground text-[11px] uppercase tracking-wide text-ink-2">
                <tr>
                  <th className="whitespace-nowrap px-4 py-2 text-left font-semibold">
                    {t("colDate")}
                  </th>
                  <th className="px-3 py-2 text-left font-semibold">
                    {t("colSupplier")}
                  </th>
                  <th className="px-3 py-2 text-left font-semibold">
                    {t("colProduct")}
                  </th>
                  <th className={thCls}>{t("colCartons")}</th>
                  <th className={thCls}>{t("colLoose")}</th>
                  <th className={thCls}>{t("colUnits")}</th>
                  <th className={thCls}>{t("colCostPerCarton")}</th>
                  <th className={`${thCls} pr-4`}>{t("colLineTotal")}</th>
                </tr>
              </thead>
              <tbody>
                {report.purchases.map((r, i) => (
                  <tr
                    key={`${r.purchaseId}-${i}`}
                    className={cn(i > 0 && "border-t border-rule-hair")}
                  >
                    <td className="num whitespace-nowrap px-4 py-2 text-ink-2">
                      {fmtDateTime(r.date)}
                    </td>
                    <td className="px-3 py-2 text-ink-2">{r.supplierName}</td>
                    <td className="px-3 py-2">
                      <p className="font-semibold text-ink">{r.productName}</p>
                      <p className="num text-[10px] text-ink-2">{r.sku}</p>
                    </td>
                    <td className={cn(tdNum, "text-ink-2")}>{r.qtyCartons}</td>
                    <td className={cn(tdNum, "text-ink-2")}>
                      {r.qtyLooseUnits}
                    </td>
                    <td className={cn(tdNum, "text-ink-2")}>{r.units}</td>
                    <td className={cn(tdNum, "text-ink")}>
                      {formatRWF(r.costPerCarton)}
                    </td>
                    <td className={cn(tdNum, "pr-4 font-bold text-ink")}>
                      {formatRWF(r.lineTotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-rule bg-ground font-semibold">
                <tr>
                  <td colSpan={5} className="px-4 py-2 text-ink">
                    {t("totalsRow")}
                  </td>
                  <td className={cn(tdNum, "text-ink")}>
                    {report.totals.purchases.units}
                  </td>
                  <td className={cn(tdNum, "text-ink-2")}>—</td>
                  <td className={cn(tdNum, "pr-4 font-bold text-ink")}>
                    {formatRWF(report.totals.purchases.cost)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      <p className="text-center text-xs text-ink-2">{t("scopeNote")}</p>
    </main>
  );
}
