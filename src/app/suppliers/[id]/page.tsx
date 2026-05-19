import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/auth-guards";
import { formatRWF } from "@/lib/format";
import { getRecentPurchases, getSupplier } from "@/lib/suppliers/queries";
import { SupplierForm } from "../_components/SupplierForm";

export default async function EditSupplierPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireOwner();

  const { id } = await params;
  const [supplier, purchases] = await Promise.all([
    getSupplier(id),
    getRecentPurchases(id, 20),
  ]);

  if (!supplier) notFound();

  return (
    <main className="mx-auto max-w-2xl p-4 sm:p-6">
      <header className="mb-4">
        <Link
          href="/suppliers"
          className="text-sm text-zinc-600 hover:underline"
        >
          ← Suppliers
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">{supplier.name}</h1>
        {supplier.phone && (
          <p className="font-mono text-xs text-zinc-500">{supplier.phone}</p>
        )}
      </header>

      <SupplierForm mode={{ kind: "edit", id, supplier }} />

      <section className="mt-8">
        <h2 className="text-lg font-medium">Recent purchases</h2>
        <p className="mt-1 text-xs text-zinc-600">Last 20.</p>
        <div className="mt-2 overflow-hidden rounded-2xl border border-zinc-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs font-medium uppercase text-zinc-600">
              <tr>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Total</th>
                <th className="hidden px-3 py-2 sm:table-cell">Note</th>
              </tr>
            </thead>
            <tbody>
              {purchases.map((p) => (
                <tr key={p.id} className="border-t border-zinc-200">
                  <td className="px-3 py-2 text-xs text-zinc-600">
                    {new Date(p.date).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 uppercase text-zinc-700">
                      {p.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-sm tabular-nums">
                    {formatRWF(p.totalCost)}
                  </td>
                  <td className="hidden max-w-[240px] truncate px-3 py-2 text-xs text-zinc-600 sm:table-cell">
                    {p.note ?? ""}
                  </td>
                </tr>
              ))}
              {purchases.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-zinc-500">
                    No purchases yet.
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
