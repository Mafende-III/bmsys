import Link from "next/link";
import { requireOwner } from "@/lib/auth-guards";
import { listCategoriesWithCounts } from "@/lib/categories/queries";

export default async function CategoriesPage() {
  await requireOwner();
  const categories = await listCategoriesWithCounts();

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
          <h1 className="mt-1 text-2xl font-semibold">Categories</h1>
          <p className="text-sm text-zinc-600">
            {categories.length}{" "}
            {categories.length === 1 ? "category" : "categories"}
          </p>
        </div>
        <Link
          href="/categories/new"
          data-tour="categories-new"
          className="self-start rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 sm:self-auto"
        >
          + New category
        </Link>
      </header>

      <div className="mt-4 overflow-hidden rounded-2xl border border-zinc-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs font-medium uppercase text-zinc-600">
            <tr>
              <th className="px-3 py-2">Icon</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Slug</th>
              <th className="px-3 py-2 text-right">Products</th>
              <th className="px-3 py-2 text-right">Sort</th>
              <th className="px-3 py-2 text-right">Status</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => (
              <tr
                key={c.id}
                className="border-t border-zinc-200 hover:bg-zinc-50"
              >
                <td className="px-3 py-2 text-2xl">{c.iconEmoji}</td>
                <td className="px-3 py-2">
                  <Link
                    href={`/categories/${c.id}`}
                    className="font-medium text-zinc-900 hover:underline"
                  >
                    {c.name}
                  </Link>
                </td>
                <td className="px-3 py-2 font-mono text-xs text-zinc-600">
                  {c.slug}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {c.productCount}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {c.sortOrder}
                </td>
                <td className="px-3 py-2 text-right">
                  {c.active ? (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800">
                      Active
                    </span>
                  ) : (
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700">
                      Inactive
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {categories.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-zinc-500">
                  No categories yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
