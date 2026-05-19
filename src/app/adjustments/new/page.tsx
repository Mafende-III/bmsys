import Link from "next/link";
import { requireOwner } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import { AdjustmentForm } from "../_components/AdjustmentForm";

export default async function NewAdjustmentPage() {
  await requireOwner();

  // Pull active products and their current stock in one go.
  const products = await prisma.product.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { id: true, sku: true, name: true, unitsPerCarton: true },
  });

  if (products.length === 0) {
    return (
      <main className="mx-auto max-w-xl p-4 sm:p-6">
        <header className="mb-4">
          <Link
            href="/adjustments"
            className="text-sm text-zinc-600 hover:underline"
          >
            ← Adjustments
          </Link>
          <h1 className="mt-1 text-2xl font-semibold">New adjustment</h1>
        </header>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          You need at least one active product first.{" "}
          <Link href="/products/new" className="underline">
            Add a product
          </Link>
          .
        </div>
      </main>
    );
  }

  const stockSums = await prisma.stockMove.groupBy({
    by: ["productId"],
    where: { productId: { in: products.map((p) => p.id) } },
    _sum: { qtyUnits: true },
  });
  const stockByProduct = new Map(
    stockSums.map((s) => [s.productId, s._sum.qtyUnits ?? 0]),
  );

  const productsWithStock = products
    .map((p) => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      unitsPerCarton: p.unitsPerCarton,
      stockUnits: stockByProduct.get(p.id) ?? 0,
    }))
    .filter((p) => p.stockUnits > 0);

  return (
    <main className="mx-auto max-w-xl p-4 sm:p-6">
      <header className="mb-4">
        <Link
          href="/adjustments"
          className="text-sm text-zinc-600 hover:underline"
        >
          ← Adjustments
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">New adjustment</h1>
        <p className="text-sm text-zinc-600">
          Record a stock loss (breakage, expiry, theft, personal, sample).
          Always reduces stock; note is mandatory.
        </p>
      </header>

      <AdjustmentForm products={productsWithStock} />
    </main>
  );
}
