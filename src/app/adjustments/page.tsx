import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireOwner } from "@/lib/auth-guards";
import { listAdjustments } from "@/lib/adjustments/queries";
import {
  ADJUSTMENT_REASONS,
  type AdjustmentReason,
} from "@/lib/adjustments/schema";
import { ADJUSTMENT_LABEL, EMPTY } from "@/lib/copy";

type SearchParams = { reason?: string };

const reasonBadge: Record<string, string> = {
  ADJUSTMENT_BREAKAGE: "bg-red-100 text-red-800",
  ADJUSTMENT_EXPIRY: "bg-amber-100 text-amber-800",
  ADJUSTMENT_PERSONAL: "bg-indigo-100 text-indigo-800",
  ADJUSTMENT_THEFT: "bg-zinc-900 text-white",
  ADJUSTMENT_SAMPLE: "bg-emerald-100 text-emerald-800",
};

export default async function AdjustmentsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireOwner();

  const params = await searchParams;
  const reason = (params.reason as AdjustmentReason | "all" | undefined) ?? "all";
  const adjustments = await listAdjustments({ reason });
  const t = await getTranslations("adjustments");
  const tc = await getTranslations("common");

  return (
    <main className="mx-auto max-w-4xl p-4 sm:p-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
        <Link
          href="/adjustments/new"
          className="self-start rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 sm:self-auto"
        >
          {t("new")}
        </Link>
      </header>

      <form method="get" className="mt-4 flex gap-2">
        <label className="block">
          <span className="text-xs font-medium text-zinc-700">Reason</span>
          <select
            name="reason"
            defaultValue={reason}
            className="mt-1 block rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          >
            <option value="all">All reasons</option>
            {ADJUSTMENT_REASONS.map((r) => (
              <option key={r} value={r}>
                {ADJUSTMENT_LABEL[r] ?? r}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="self-end rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium hover:bg-zinc-50"
        >
          Filter
        </button>
      </form>

      <div className="mt-4 overflow-x-auto rounded-2xl border border-zinc-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs font-medium uppercase text-zinc-600">
            <tr>
              <th className="px-3 py-2">When</th>
              <th className="px-3 py-2">Product</th>
              <th className="px-3 py-2">Reason</th>
              <th className="px-3 py-2 text-right">Units</th>
              <th className="hidden px-3 py-2 sm:table-cell">Note</th>
              <th className="hidden px-3 py-2 sm:table-cell">By</th>
            </tr>
          </thead>
          <tbody>
            {adjustments.map((a) => (
              <tr key={a.id} className="border-t border-zinc-200 hover:bg-zinc-50">
                <td className="px-3 py-2 text-xs text-zinc-600">
                  {new Date(a.createdAt).toLocaleString()}
                </td>
                <td className="px-3 py-2">
                  <p className="font-medium">{a.product.name}</p>
                  <p className="font-mono text-[10px] text-zinc-500">
                    {a.product.sku}
                  </p>
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] uppercase ${reasonBadge[a.reason] ?? "bg-zinc-100 text-zinc-700"}`}
                  >
                    {ADJUSTMENT_LABEL[a.reason] ?? a.reason}
                  </span>
                </td>
                <td className="px-3 py-2 text-right font-mono text-sm tabular-nums text-red-700">
                  {a.qtyUnits}
                </td>
                <td className="hidden max-w-[280px] truncate px-3 py-2 text-xs text-zinc-700 sm:table-cell">
                  {a.note ?? ""}
                </td>
                <td className="hidden px-3 py-2 text-xs text-zinc-600 sm:table-cell">
                  {a.user.name}
                </td>
              </tr>
            ))}
            {adjustments.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-zinc-500">
                  No losses recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
