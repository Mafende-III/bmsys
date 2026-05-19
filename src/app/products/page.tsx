import Link from "next/link";
import { requireOwner } from "@/lib/auth-guards";
import { formatRWF } from "@/lib/format";
import { getCategories, getProductsWithStock } from "@/lib/products/queries";

type SearchParams = {
  search?: string;
  category?: string;
  active?: string;
};

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireOwner();

  const params = await searchParams;
  const search = params.search?.trim() || undefined;
  const category = params.category?.trim() || undefined;
  const activeFilter: boolean | "all" =
    params.active === "all"
      ? "all"
      : params.active === "false"
        ? false
        : true;

  const [products, categories] = await Promise.all([
    getProductsWithStock({ search, category, active: activeFilter }),
    getCategories(),
  ]);

  return (
    <main className="mx-auto max-w-5xl p-4 sm:p-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href="/dashboard"
            className="text-sm text-zinc-600 hover:underline"
          >
            ← Dashboard
          </Link>
          <h1 className="mt-1 text-2xl font-semibold">Products</h1>
          <p className="text-sm text-zinc-600">
            {products.length} {products.length === 1 ? "product" : "products"}
          </p>
        </div>
        <Link
          href="/products/new"
          className="self-start rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 sm:self-auto"
        >
          + New product
        </Link>
      </header>

      <form
        method="get"
        className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end"
      >
        <label className="block flex-1">
          <span className="text-xs font-medium text-zinc-700">Search</span>
          <input
            type="search"
            name="search"
            defaultValue={search ?? ""}
            placeholder="Name or SKU"
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="block sm:w-44">
          <span className="text-xs font-medium text-zinc-700">Category</span>
          <select
            name="category"
            defaultValue={category ?? ""}
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          >
            <option value="">All</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="block sm:w-32">
          <span className="text-xs font-medium text-zinc-700">Status</span>
          <select
            name="active"
            defaultValue={params.active ?? "true"}
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          >
            <option value="true">Active</option>
            <option value="false">Archived</option>
            <option value="all">All</option>
          </select>
        </label>
        <button
          type="submit"
          className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium hover:bg-zinc-50"
        >
          Filter
        </button>
      </form>

      {/* Desktop table */}
      <div className="mt-4 hidden overflow-hidden rounded-2xl border border-zinc-200 bg-white sm:block">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs font-medium uppercase text-zinc-600">
            <tr>
              <th className="px-3 py-2">SKU</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Category</th>
              <th className="px-3 py-2 text-right">Unit</th>
              <th className="px-3 py-2 text-right">Carton</th>
              <th className="px-3 py-2 text-right">Sealed</th>
              <th className="px-3 py-2 text-right">Open units</th>
              <th className="px-3 py-2 text-right">Status</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr
                key={p.id}
                className="border-t border-zinc-200 hover:bg-zinc-50"
              >
                <td className="px-3 py-2 font-mono text-xs">
                  <Link
                    href={`/products/${p.id}`}
                    className="text-zinc-900 hover:underline"
                  >
                    {p.sku}
                  </Link>
                </td>
                <td className="px-3 py-2">{p.name}</td>
                <td className="px-3 py-2 text-zinc-600">{p.category ?? "—"}</td>
                <td className="px-3 py-2 text-right">
                  {formatRWF(p.unitPrice)}
                </td>
                <td className="px-3 py-2 text-right">
                  {formatRWF(p.cartonPrice)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {p.sealedCartons}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {p.openedUnits}
                </td>
                <td className="px-3 py-2 text-right">
                  {p.active ? (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800">
                      Active
                    </span>
                  ) : (
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700">
                      Archived
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {products.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="px-3 py-6 text-center text-zinc-500"
                >
                  No products match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="mt-4 space-y-2 sm:hidden">
        {products.map((p) => (
          <Link
            key={p.id}
            href={`/products/${p.id}`}
            className="block rounded-2xl border border-zinc-200 bg-white p-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-medium">{p.name}</p>
                <p className="font-mono text-xs text-zinc-500">{p.sku}</p>
              </div>
              {p.active ? (
                <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800">
                  Active
                </span>
              ) : (
                <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700">
                  Archived
                </span>
              )}
            </div>
            <dl className="mt-2 grid grid-cols-2 gap-y-1 text-xs text-zinc-700">
              <dt>Unit</dt>
              <dd className="text-right">{formatRWF(p.unitPrice)}</dd>
              <dt>Carton</dt>
              <dd className="text-right">{formatRWF(p.cartonPrice)}</dd>
              <dt>Sealed cartons</dt>
              <dd className="text-right tabular-nums">{p.sealedCartons}</dd>
              <dt>Open units</dt>
              <dd className="text-right tabular-nums">{p.openedUnits}</dd>
            </dl>
          </Link>
        ))}
        {products.length === 0 && (
          <p className="rounded-2xl border border-zinc-200 bg-white p-6 text-center text-sm text-zinc-500">
            No products match these filters.
          </p>
        )}
      </div>
    </main>
  );
}
