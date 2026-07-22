import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ReceiptText, Ticket } from "lucide-react";
import { requireOwner } from "@/lib/auth-guards";
import { getSaleDetail } from "@/lib/sales/history";
import { formatRWF } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function SaleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireOwner();
  const { id } = await params;
  const sale = await getSaleDetail(id);
  if (!sale) notFound();

  const t = await getTranslations("salesHistory");

  const hasApproximateCost = sale.lines.some((l) => l.costIsApproximate);

  return (
    <main className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6">
      <header>
        <Link href="/sales" className="text-sm text-zinc-600 hover:underline">
          ← {t("title")}
        </Link>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold">
          <ReceiptText className="h-6 w-6" strokeWidth={2} />
          {t("detailTitle")}
        </h1>
        <p className="text-sm text-zinc-600">
          {new Date(sale.date).toLocaleString(undefined, {
            weekday: "short",
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}{" "}
          · {sale.channelName} · {sale.paymentMethod}
          {sale.paymentReference ? ` (${sale.paymentReference})` : ""} ·{" "}
          {t("soldBy", { name: sale.sellerName })}
        </p>
      </header>

      {sale.couponCode && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <Ticket className="h-4 w-4 shrink-0" strokeWidth={2} />
          <span>
            {t("couponUsed", { code: sale.couponCode })}
            {sale.couponNotes ? ` — ${sale.couponNotes}` : ""}
          </span>
        </div>
      )}

      {/* Lines */}
      <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-xs text-zinc-600">
              <tr>
                <th className="px-4 py-2 text-left font-medium">
                  {t("profitColProduct")}
                </th>
                <th className="px-3 py-2 text-right font-medium">
                  {t("colQty")}
                </th>
                <th className="px-3 py-2 text-right font-medium">
                  {t("colGross")}
                </th>
                <th className="px-3 py-2 text-right font-medium">
                  {t("colDiscount")}
                </th>
                <th className="px-3 py-2 text-right font-medium">
                  {t("colCost")}
                </th>
                <th className="px-4 py-2 text-right font-medium">
                  {t("colProfit")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {sale.lines.map((l, i) => (
                <tr key={`${l.productId}-${i}`}>
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-zinc-800">{l.name}</p>
                    <p className="text-[10px] text-zinc-500">
                      {l.qty} ×{" "}
                      {l.saleUnit === "CARTON" ? t("unitCarton") : t("unitSingle")}{" "}
                      · {formatRWF(l.unitPrice)}
                      {l.costIsApproximate ? " *" : ""}
                    </p>
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums text-zinc-700">
                    {l.units}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums text-zinc-700">
                    {formatRWF(l.gross)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums text-amber-700">
                    {l.discount > 0 ? `−${formatRWF(l.discount)}` : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums text-zinc-500">
                    {formatRWF(l.costTotal)}
                  </td>
                  <td
                    className={`px-4 py-2.5 text-right font-mono font-semibold tabular-nums ${
                      l.profit >= 0 ? "text-green-700" : "text-red-700"
                    }`}
                  >
                    {l.profit >= 0 ? "+" : ""}
                    {formatRWF(l.profit)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="space-y-1 border-t border-zinc-200 bg-zinc-50 px-4 py-3 text-sm">
          {sale.discountTotal > 0 && (
            <div className="flex justify-between text-amber-700">
              <span>{t("totalDiscount")}</span>
              <span className="font-mono tabular-nums">
                −{formatRWF(sale.discountTotal)}
              </span>
            </div>
          )}
          <div className="flex justify-between text-zinc-700">
            <span>{t("totalPaid")}</span>
            <span className="font-mono tabular-nums">
              {formatRWF(sale.total)}
            </span>
          </div>
          <div className="flex justify-between text-zinc-500">
            <span>{t("totalCost")}</span>
            <span className="font-mono tabular-nums">
              {formatRWF(sale.costTotal)}
            </span>
          </div>
          <div className="flex justify-between pt-1 text-base font-semibold">
            <span>{t("totalProfit")}</span>
            <span
              className={`font-mono tabular-nums ${
                sale.profit >= 0 ? "text-green-700" : "text-red-700"
              }`}
            >
              {sale.profit >= 0 ? "+" : ""}
              {formatRWF(sale.profit)}
            </span>
          </div>
        </div>
      </section>

      {hasApproximateCost && (
        <p className="text-xs text-zinc-500">{t("approximateCostNote")}</p>
      )}
    </main>
  );
}
