import Link from "next/link";
import { requireOwner } from "@/lib/auth-guards";
import { formatRWF } from "@/lib/format";
import { listSuppliersWithCounts } from "@/lib/suppliers/queries";

type SearchParams = { search?: string };

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireOwner();

  const params = await searchParams;
  const search = params.search?.trim() || undefined;

  const suppliers = await listSuppliersWithCounts({ search });

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
          <h1 className="mt-1 text-2xl font-semibold">Suppliers</h1>
          <p className="text-sm text-zinc-600">
            {suppliers.length}{" "}
            {suppliers.length === 1 ? "supplier" : "suppliers"}
          </p>
        </div>
        <Link
          href="/suppliers/new"
          className="self-start rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 sm:self-auto"
        >
          + New supplier
        </Link>
      </header>

      <form method="get" className="mt-4 flex gap-2">
        <input
          type="search"
          name="search"
          defaultValue={search ?? ""}
          placeholder="Search by name or phone"
          className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium hover:bg-zinc-50"
        >
          Search
        </button>
      </form>

      <div className="mt-4 hidden overflow-hidden rounded-2xl border border-zinc-200 bg-white sm:block">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs font-medium uppercase text-zinc-600">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Phone</th>
              <th className="px-3 py-2 text-right">Purchases</th>
              <th className="px-3 py-2">Last purchase</th>
            </tr>
          </thead>
          <tbody>
            {suppliers.map((s) => (
              <tr
                key={s.id}
                className="border-t border-zinc-200 hover:bg-zinc-50"
              >
                <td className="px-3 py-2">
                  <Link
                    href={`/suppliers/${s.id}`}
                    className="font-medium text-zinc-900 hover:underline"
                  >
                    {s.name}
                  </Link>
                </td>
                <td className="px-3 py-2 font-mono text-xs text-zinc-600">
                  {s.phone ?? "—"}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {s.purchaseCount}
                </td>
                <td className="px-3 py-2 text-xs text-zinc-600">
                  {s.lastPurchaseAt
                    ? new Date(s.lastPurchaseAt).toLocaleDateString()
                    : "—"}
                </td>
              </tr>
            ))}
            {suppliers.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-zinc-500">
                  No suppliers match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 space-y-2 sm:hidden">
        {suppliers.map((s) => (
          <Link
            key={s.id}
            href={`/suppliers/${s.id}`}
            className="block rounded-2xl border border-zinc-200 bg-white p-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-medium">{s.name}</p>
                {s.phone && (
                  <p className="font-mono text-xs text-zinc-500">{s.phone}</p>
                )}
              </div>
              <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700 tabular-nums">
                {s.purchaseCount}
                {s.purchaseCount === 1 ? " purchase" : " purchases"}
              </span>
            </div>
            {s.lastPurchaseAt && (
              <p className="mt-2 text-xs text-zinc-600">
                Last: {new Date(s.lastPurchaseAt).toLocaleDateString()}
              </p>
            )}
          </Link>
        ))}
        {suppliers.length === 0 && (
          <p className="rounded-2xl border border-zinc-200 bg-white p-6 text-center text-sm text-zinc-500">
            No suppliers match.
          </p>
        )}
      </div>
    </main>
  );
}
