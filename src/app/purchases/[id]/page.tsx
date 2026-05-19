import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/auth-guards";
import { formatRWF } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { getPurchaseWithLines } from "@/lib/purchases/queries";
import { PurchaseForm } from "../_components/PurchaseForm";

const statusBadge: Record<string, string> = {
  DRAFT: "bg-amber-100 text-amber-800",
  RECEIVED: "bg-green-100 text-green-800",
  CANCELLED: "bg-zinc-100 text-zinc-600",
};

export default async function PurchaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireOwner();

  const { id } = await params;
  const purchase = await getPurchaseWithLines(id);
  if (!purchase) notFound();

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
      <header className="mb-4 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link
            href="/purchases"
            className="text-sm text-zinc-600 hover:underline"
          >
            ← Purchases
          </Link>
          <h1 className="mt-1 truncate text-2xl font-semibold">
            {purchase.supplier.name}
          </h1>
          <p className="text-sm text-zinc-600">
            {new Date(purchase.date).toLocaleDateString()} · created by{" "}
            {purchase.user.name} · {formatRWF(purchase.totalCost)}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium uppercase ${statusBadge[purchase.status] ?? ""}`}
        >
          {purchase.status}
        </span>
      </header>

      <PurchaseForm
        mode={{
          kind: "edit",
          id: purchase.id,
          status: purchase.status,
          supplierId: purchase.supplierId,
          date: purchase.date,
          note: purchase.note ?? "",
          lines: purchase.lines.map((l) => ({
            productId: l.productId,
            qtyCartons: l.qtyCartons,
            unitCost: l.unitCost,
          })),
        }}
        suppliers={suppliers}
        products={products}
      />
    </main>
  );
}
