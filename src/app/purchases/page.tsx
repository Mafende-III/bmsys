import Link from "next/link";
import { requireOwner } from "@/lib/auth-guards";
import { formatRWF } from "@/lib/format";
import { listPurchases, type PurchaseStatus } from "@/lib/purchases/queries";

type SearchParams = { status?: string };

const validStatus = (s: string | undefined): PurchaseStatus => {
  if (s === "DRAFT" || s === "RECEIVED" || s === "CANCELLED" || s === "all")
    return s;
  return "all";
};

const statusBadge: Record<string, string> = {
  DRAFT: "bg-amber-100 text-amber-800",
  RECEIVED: "bg-green-100 text-green-800",
  CANCELLED: "bg-zinc-100 text-zinc-600",
};

export default async function PurchasesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireOwner();

  const params = await searchParams;
  const status = validStatus(params.status);
  const purchases = await listPurchases({ status });

  return (
    <main className="mx-auto max-w-4xl p-4 sm:p-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href="/dashboard"
            className="text-sm text-zinc-600 hover:underline"
          >
            ← Dashboard
          </Link>
          <h1 className="mt-1 text-2xl font-semibold">Purchases</h1>
          <p className="text-sm text-zinc-600">
            {purchases.length}{" "}
            {purchases.length === 1 ? "purchase" : "purchases"}
          </p>
        </div>
        <Link
          href="/purchases/new"
          className="self-start rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 sm:self-auto"
        >
          + New purchase
        </Link>
      </header>

      <form method="get" className="mt-4 flex gap-2">
        <label className="block">
          <span className="text-xs font-medium text-zinc-700">Status</span>
          <select
            name="status"
            defaultValue={status}
            className="mt-1 block rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          >
            <option value="all">All</option>
            <option value="DRAFT">Draft</option>
            <option value="RECEIVED">Received</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </label>
        <button
          type="submit"
          className="self-end rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium hover:bg-zinc-50"
        >
          Filter
        </button>
      </form>

      <div className="mt-4 hidden overflow-hidden rounded-2xl border border-zinc-200 bg-white sm:block">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs font-medium uppercase text-zinc-600">
            <tr>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Supplier</th>
              <th className="px-3 py-2 text-right">Lines</th>
              <th className="px-3 py-2 text-right">Total</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {purchases.map((p) => (
              <tr
                key={p.id}
                className="border-t border-zinc-200 hover:bg-zinc-50"
              >
                <td className="px-3 py-2 text-xs text-zinc-700">
                  <Link
                    href={`/purchases/${p.id}`}
                    className="hover:underline"
                  >
                    {new Date(p.date).toLocaleDateString()}
                  </Link>
                </td>
                <td className="px-3 py-2">{p.supplier.name}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {p._count.lines}
                </td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">
                  {formatRWF(p.totalCost)}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs uppercase ${statusBadge[p.status] ?? ""}`}
                  >
                    {p.status}
                  </span>
                </td>
              </tr>
            ))}
            {purchases.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-zinc-500">
                  No purchases match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 space-y-2 sm:hidden">
        {purchases.map((p) => (
          <Link
            key={p.id}
            href={`/purchases/${p.id}`}
            className="block rounded-2xl border border-zinc-200 bg-white p-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-medium">{p.supplier.name}</p>
                <p className="text-xs text-zinc-500">
                  {new Date(p.date).toLocaleDateString()}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] uppercase ${statusBadge[p.status] ?? ""}`}
              >
                {p.status}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-zinc-700">
              <span>
                {p._count.lines} line{p._count.lines === 1 ? "" : "s"}
              </span>
              <span className="font-mono tabular-nums">
                {formatRWF(p.totalCost)}
              </span>
            </div>
          </Link>
        ))}
        {purchases.length === 0 && (
          <p className="rounded-2xl border border-zinc-200 bg-white p-6 text-center text-sm text-zinc-500">
            No purchases match.
          </p>
        )}
      </div>
    </main>
  );
}
