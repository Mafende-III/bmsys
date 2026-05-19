import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ProductForm } from "../_components/ProductForm";
import {
  getCategories,
  getProduct,
  getRecentStockMoves,
} from "@/lib/products/queries";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const { id } = await params;
  const [product, moves, categories] = await Promise.all([
    getProduct(id),
    getRecentStockMoves(id, 20),
    getCategories(),
  ]);

  if (!product) notFound();

  return (
    <main className="mx-auto max-w-2xl p-4 sm:p-6">
      <header className="mb-4 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link
            href="/products"
            className="text-sm text-zinc-600 hover:underline"
          >
            ← Products
          </Link>
          <h1 className="mt-1 truncate text-2xl font-semibold">
            {product.name}
          </h1>
          <p className="font-mono text-xs text-zinc-500">{product.sku}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Link
            href={`/products/${id}/prices`}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm hover:bg-zinc-50"
          >
            Channel prices
          </Link>
          {product.active && (
            <Link
              href={`/products/${id}/archive`}
              className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-sm text-red-700 hover:bg-red-50"
            >
              Archive
            </Link>
          )}
        </div>
      </header>

      <ProductForm
        mode={{ kind: "edit", id, product }}
        categories={categories}
      />

      <section className="mt-8">
        <h2 className="text-lg font-medium">Recent stock movements</h2>
        <p className="mt-1 text-xs text-zinc-600">Last 20 ledger entries.</p>
        <div className="mt-2 overflow-hidden rounded-2xl border border-zinc-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs font-medium uppercase text-zinc-600">
              <tr>
                <th className="px-3 py-2">When</th>
                <th className="px-3 py-2">Reason</th>
                <th className="px-3 py-2 text-right">Δ units</th>
                <th className="hidden px-3 py-2 sm:table-cell">Note</th>
                <th className="hidden px-3 py-2 sm:table-cell">By</th>
              </tr>
            </thead>
            <tbody>
              {moves.map((m) => (
                <tr key={m.id} className="border-t border-zinc-200">
                  <td className="px-3 py-2 text-xs text-zinc-600">
                    {new Date(m.createdAt).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-xs">{m.reason}</td>
                  <td
                    className={`px-3 py-2 text-right font-mono text-sm tabular-nums ${
                      m.qtyUnits > 0
                        ? "text-green-700"
                        : m.qtyUnits < 0
                          ? "text-red-700"
                          : "text-zinc-600"
                    }`}
                  >
                    {m.qtyUnits > 0 ? "+" : ""}
                    {m.qtyUnits}
                  </td>
                  <td className="hidden max-w-[240px] truncate px-3 py-2 text-xs text-zinc-600 sm:table-cell">
                    {m.note ?? ""}
                  </td>
                  <td className="hidden px-3 py-2 text-xs text-zinc-600 sm:table-cell">
                    {m.user.name}
                  </td>
                </tr>
              ))}
              {moves.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-3 py-6 text-center text-zinc-500"
                  >
                    No stock movements yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
