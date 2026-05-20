import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireOwner } from "@/lib/auth-guards";
import { formatRWF } from "@/lib/format";
import {
  getCategoriesForPicker,
  getProductsWithStock,
} from "@/lib/products/queries";

type SearchParams = {
  search?: string;
  categoryId?: string;
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
  const categoryId = params.categoryId?.trim() || undefined;
  const activeFilter: boolean | "all" =
    params.active === "all"
      ? "all"
      : params.active === "false"
        ? false
        : true;

  const [products, categories] = await Promise.all([
    getProductsWithStock({ search, categoryId, active: activeFilter }),
    getCategoriesForPicker(),
  ]);
  const t = await getTranslations("products");
  const tc = await getTranslations("common");

  return (
    <main className="mx-auto max-w-5xl p-4 sm:p-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href="/dashboard"
            className="text-sm text-zinc-600 hover:underline"
          >
            ← {tc("dashboard")}
          </Link>
          <h1 className="mt-1 text-2xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-zinc-600">
            {t("count", { count: products.length })}
          </p>
        </div>
        <Link
          href="/products/new"
          data-tour="products-new"
          className="self-start rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 sm:self-auto"
        >
          {t("new")}
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
            placeholder="Name or code"
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="block sm:w-52">
          <span className="text-xs font-medium text-zinc-700">Category</span>
          <select
            name="categoryId"
            defaultValue={categoryId ?? ""}
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          >
            <option value="">All</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.iconEmoji} {c.name}
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
              <th className="px-3 py-2">Code</th>
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
                <td className="px-3 py-2">
                  <span className="mr-1">
                    {p.iconEmoji ?? p.categoryIconEmoji ?? "📦"}
                  </span>
                  {p.name}
                </td>
                <td className="px-3 py-2 text-zinc-600">
                  {p.categoryName ?? "—"}
                </td>
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
                <td colSpan={8} className="px-3 py-6 text-center text-zinc-500">
                  Nothing matches. Try clearing the filters, or tap{" "}
                  <strong>+ New product</strong>.
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
                <p className="truncate font-medium">
                  <span className="mr-1">
                    {p.iconEmoji ?? p.categoryIconEmoji ?? "📦"}
                  </span>
                  {p.name}
                </p>
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
              <dt>Category</dt>
              <dd className="text-right">{p.categoryName ?? "—"}</dd>
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
