import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireOwner } from "@/lib/auth-guards";
import { getStockUnits } from "@/lib/balances";
import { prisma } from "@/lib/prisma";
import { archiveProduct } from "@/lib/products/actions";
import { getProduct } from "@/lib/products/queries";

export default async function ArchiveProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireOwner();

  const { id } = await params;
  const product = await getProduct(id);
  if (!product) notFound();
  if (!product.active) redirect(`/products/${id}`);

  const [totalUnits, openedCount] = await Promise.all([
    getStockUnits(id),
    prisma.carton.count({ where: { productId: id, state: "OPENED" } }),
  ]);

  const canArchive = totalUnits === 0 && openedCount === 0;
  const idempotencyKey = crypto.randomUUID();

  return (
    <main className="mx-auto max-w-md p-4 sm:p-6">
      <header className="mb-4">
        <Link
          href={`/products/${id}`}
          className="text-sm text-zinc-600 hover:underline"
        >
          ← Back to product
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">Archive product</h1>
        <p className="text-sm text-zinc-600">
          <span className="font-mono">{product.sku}</span> — {product.name}
        </p>
      </header>

      {canArchive ? (
        <form
          action={async () => {
            "use server";
            const result = await archiveProduct(idempotencyKey, id);
            if (!result.ok) {
              throw new Error(result.error);
            }
            redirect("/products");
          }}
          className="space-y-4"
        >
          <p className="text-sm text-zinc-700">
            This sets the product to <strong>archived</strong>. It is hidden
            from the active filter but its history (sales, audits) is preserved.
            You can restore it later from the edit page.
          </p>
          <div className="flex gap-2">
            <Link
              href={`/products/${id}`}
              className="flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-center text-sm font-medium hover:bg-zinc-50"
            >
              Cancel
            </Link>
            <button
              type="submit"
              className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              Archive
            </button>
          </div>
        </form>
      ) : (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-900">
            Cannot archive yet
          </p>
          <ul className="mt-2 list-disc pl-5 text-sm text-amber-800">
            {totalUnits !== 0 && (
              <li>
                Stock = {totalUnits} units (sell or adjust to zero before
                archiving)
              </li>
            )}
            {openedCount > 0 && (
              <li>
                {openedCount} open carton{openedCount === 1 ? "" : "s"} (close
                them out first)
              </li>
            )}
          </ul>
          <Link
            href={`/products/${id}`}
            className="mt-3 inline-block text-sm text-amber-900 underline"
          >
            ← Back to product
          </Link>
        </div>
      )}
    </main>
  );
}
