import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PackagePlus } from "lucide-react";
import { requireOwner } from "@/lib/auth-guards";
import { getRestockPlan } from "@/lib/restock/queries";
import { COVER_TARGET_DAYS, BURN_WINDOW_DAYS } from "@/lib/restock/plan";
import { formatRWF } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function RestockPage() {
  await requireOwner();
  const plan = await getRestockPlan();
  const t = await getTranslations("restock");
  const tc = await getTranslations("common");

  return (
    <main className="mx-auto max-w-4xl space-y-5 p-4 sm:p-6">
      <header>
        <Link
          href="/dashboard"
          className="text-sm text-zinc-600 hover:underline"
        >
          ← {tc("dashboard")}
        </Link>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold">
          <PackagePlus className="h-6 w-6" strokeWidth={2} />
          {t("title")}
        </h1>
        <p className="text-sm text-zinc-600">
          {t("subtitle", {
            burnDays: BURN_WINDOW_DAYS,
            coverDays: COVER_TARGET_DAYS,
          })}
        </p>
      </header>

      {/* Order summary */}
      <section
        data-tour="restock-summary"
        className="grid grid-cols-3 gap-2 rounded-2xl border border-zinc-200 bg-white p-3 text-xs"
      >
        <div>
          <p className="text-[10px] uppercase tracking-wide text-zinc-500">
            {t("statUrgent")}
          </p>
          <p
            className={`mt-0.5 font-mono text-lg font-semibold tabular-nums ${
              plan.urgentCount > 0 ? "text-red-700" : "text-green-700"
            }`}
          >
            {plan.urgentCount}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-zinc-500">
            {t("statToOrder")}
          </p>
          <p className="mt-0.5 font-mono text-lg font-semibold tabular-nums">
            {plan.orderRows.length}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-zinc-500">
            {t("statOrderCost")}
          </p>
          <p className="mt-0.5 font-mono text-lg font-semibold tabular-nums">
            {formatRWF(plan.totalOrderCost)}
          </p>
        </div>
      </section>

      {/* Plan table */}
      <section
        data-tour="restock-table"
        className="overflow-hidden rounded-2xl border border-zinc-200 bg-white"
      >
        {plan.rows.length === 0 ? (
          <p className="p-8 text-center text-sm text-zinc-600">
            {t("empty")}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-xs text-zinc-600">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">
                    {t("colProduct")}
                  </th>
                  <th className="px-3 py-2 text-right font-medium">
                    {t("colStock")}
                  </th>
                  <th className="px-3 py-2 text-right font-medium">
                    {t("colBurn")}
                  </th>
                  <th className="px-3 py-2 text-right font-medium">
                    {t("colDaysLeft")}
                  </th>
                  <th className="px-3 py-2 text-right font-medium">
                    {t("colOrder")}
                  </th>
                  <th className="px-4 py-2 text-right font-medium">
                    {t("colCost")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {plan.rows.map((r) => {
                  const badge =
                    r.urgency === "OUT"
                      ? { label: t("badgeOut"), cls: "bg-red-100 text-red-700" }
                      : r.urgency === "CRITICAL"
                        ? {
                            label: t("badgeDays", { count: r.daysToOut ?? 0 }),
                            cls: "bg-red-100 text-red-700",
                          }
                        : r.urgency === "LOW"
                          ? {
                              label: t("badgeDays", {
                                count: r.daysToOut ?? 0,
                              }),
                              cls: "bg-amber-100 text-amber-800",
                            }
                          : {
                              label:
                                r.daysToOut == null
                                  ? t("badgeNoSales")
                                  : t("badgeDays", { count: r.daysToOut }),
                              cls: "bg-zinc-100 text-zinc-600",
                            };
                  return (
                    <tr key={r.productId}>
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-zinc-800">{r.name}</p>
                        <p className="font-mono text-[10px] text-zinc-500">
                          {r.sku}
                        </p>
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums text-zinc-700">
                        {r.stockUnits}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums text-zinc-500">
                        {r.dailyBurn.toFixed(1)}/d
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <span
                          className={`inline-block rounded-md px-1.5 py-0.5 font-mono text-xs tabular-nums ${badge.cls}`}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                        {r.suggestedCartons > 0 ? (
                          <span className="font-semibold text-zinc-900">
                            {t("orderCartons", {
                              count: r.suggestedCartons,
                              units: r.suggestedUnits,
                            })}
                          </span>
                        ) : (
                          <span className="text-zinc-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums text-zinc-700">
                        {r.suggestedCartons > 0
                          ? formatRWF(r.estimatedCost)
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {plan.totalOrderCost > 0 && (
                <tfoot className="border-t-2 border-zinc-200 bg-zinc-50">
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-2.5 text-right text-sm font-medium"
                    >
                      {t("totalOrderCost")}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-base font-semibold tabular-nums">
                      {formatRWF(plan.totalOrderCost)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </section>

      <p className="text-center text-xs text-zinc-500">{t("scopeNote")}</p>
    </main>
  );
}
