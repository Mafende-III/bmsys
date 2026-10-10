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
    <main className="mx-auto max-w-2xl space-y-3 p-4">
      <header>
        <h1 className="text-xl font-bold text-ink">Receive stock</h1>
        <p className="text-[13px] text-ink-2">
          Draft a purchase, then receive it to add stock to the ledger.
        </p>
      </header>

      {suppliers.length === 0 ? (
        <div className="rounded-sheet bg-warning-wash p-4 text-sm font-semibold text-warning">
          You need at least one supplier before drafting a purchase.{" "}
          <Link href="/suppliers/new" className="underline">
            Add a supplier
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
