import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Ticket } from "lucide-react";
import { requireOwner } from "@/lib/auth-guards";
import { getSaleDetail } from "@/lib/sales/history";
import { formatRWF } from "@/lib/format";
import { Card } from "@/components/ui";
import { cn } from "@/lib/cn";

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
    <main className="mx-auto max-w-2xl space-y-3 p-4">
      <header>
        <h1 className="text-xl font-bold text-ink">{t("detailTitle")}</h1>
        <p className="text-[13px] text-ink-2">
          <span className="num">
            {new Date(sale.date).toLocaleString(undefined, {
              weekday: "short",
              year: "numeric",
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>{" "}
          · {sale.channelName} · {sale.paymentMethod}
          {sale.paymentReference ? ` (${sale.paymentReference})` : ""} ·{" "}
          {t("soldBy", { name: sale.sellerName })}
        </p>
      </header>

      {sale.couponCode && (
        <div className="flex items-center gap-2 rounded-panel bg-warning-wash px-3.5 py-2.5 text-sm font-semibold text-warning">
          <Ticket className="h-4 w-4 shrink-0" strokeWidth={2.2} />
          <span>
            {t("couponUsed", { code: sale.couponCode })}
            {sale.couponNotes ? ` — ${sale.couponNotes}` : ""}
          </span>
        </div>
      )}

      {/* Lines */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-ground text-[11px] uppercase tracking-wide text-ink-2">
              <tr>
                <th className="px-4 py-2 text-left font-semibold">
                  {t("profitColProduct")}
                </th>
                <th className="px-3 py-2 text-right font-semibold">
                  {t("colQty")}
                </th>
                <th className="px-3 py-2 text-right font-semibold">
                  {t("colGross")}
                </th>
                <th className="px-3 py-2 text-right font-semibold">
                  {t("colDiscount")}
                </th>
                <th className="px-3 py-2 text-right font-semibold">
                  {t("colCost")}
                </th>
                <th className="px-4 py-2 text-right font-semibold">
                  {t("colProfit")}
                </th>
              </tr>
            </thead>
            <tbody>
              {sale.lines.map((l, i) => (
                <tr
                  key={`${l.productId}-${i}`}
                  className={cn(i > 0 && "border-t border-rule-hair")}
                >
                  <td className="px-4 py-2.5">
                    <p className="font-bold text-ink">{l.name}</p>
                    <p className="num text-[10px] text-ink-2">
                      {l.qty} ×{" "}
                      {l.saleUnit === "CARTON" ? t("unitCarton") : t("unitSingle")}{" "}
                      · {formatRWF(l.unitPrice)}
                      {l.costIsApproximate ? " *" : ""}
                    </p>
                  </td>
                  <td className="num px-3 py-2.5 text-right text-ink-2">
                    {l.units}
                  </td>
                  <td className="num px-3 py-2.5 text-right text-ink-2">
                    {formatRWF(l.gross)}
                  </td>
                  <td className="num px-3 py-2.5 text-right text-warning">
                    {l.discount > 0 ? `−${formatRWF(l.discount)}` : "—"}
                  </td>
                  <td className="num px-3 py-2.5 text-right text-ink-2">
                    {formatRWF(l.costTotal)}
                  </td>
                  <td
                    className={cn(
                      "num px-4 py-2.5 text-right font-bold",
                      l.profit >= 0 ? "text-success" : "text-error",
                    )}
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
        <div className="space-y-1 border-t border-rule-hair bg-ground px-4 py-3 text-sm">
          {sale.discountTotal > 0 && (
            <div className="flex justify-between font-semibold text-warning">
              <span>{t("totalDiscount")}</span>
              <span className="num">−{formatRWF(sale.discountTotal)}</span>
            </div>
          )}
          <div className="flex justify-between text-ink">
            <span>{t("totalPaid")}</span>
            <span className="num font-semibold">{formatRWF(sale.total)}</span>
          </div>
          <div className="flex justify-between text-ink-2">
            <span>{t("totalCost")}</span>
            <span className="num">{formatRWF(sale.costTotal)}</span>
          </div>
          <div className="flex justify-between pt-1 text-base font-bold text-ink">
            <span>{t("totalProfit")}</span>
            <span
              className={cn(
                "num",
                sale.profit >= 0 ? "text-success" : "text-error",
              )}
            >
              {sale.profit >= 0 ? "+" : ""}
              {formatRWF(sale.profit)}
            </span>
          </div>
        </div>
      </Card>

      {hasApproximateCost && (
        <p className="text-xs text-ink-2">{t("approximateCostNote")}</p>
      )}
    </main>
  );
}
