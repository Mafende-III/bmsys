import Link from "next/link";
import { requireOwner } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import { PurchaseForm } from "../_components/PurchaseForm";

export default async function NewPurchasePage() {
  await requireOwner();

  const [suppliers, products] = await Promise.all([
    prisma.supplier.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.product.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        sku: true,
        name: true,
        unitsPerCarton: true,
        costPerCarton: true,
      },
    }),
  ]);

  return (
    <main className="mx-auto max-w-3xl p-4 sm:p-6">
      <header className="mb-4">
        <Link
          href="/purchases"
          className="text-sm text-zinc-600 hover:underline"
        >
          ← Purchases
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">New purchase</h1>
        <p className="text-sm text-zinc-600">
          Draft a purchase, then receive it to add stock to the ledger.
        </p>
      </header>

      {suppliers.length === 0 ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          You need at least one supplier before drafting a purchase.{" "}
          <Link href="/suppliers/new" className="underline">
            Add a supplier
          </Link>
          .
        </div>
      ) : products.length === 0 ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          You need at least one active product.{" "}
          <Link href="/products/new" className="underline">
            Add a product
          </Link>
          .
        </div>
      ) : (
        <PurchaseForm
          mode={{ kind: "create" }}
          suppliers={suppliers}
          products={products}
        />
      )}
    </main>
  );
}
