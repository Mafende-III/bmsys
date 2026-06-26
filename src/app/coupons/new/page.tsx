import Link from "next/link";
import { Ticket } from "lucide-react";
import { requireOwner } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import { CouponForm } from "../_components/CouponForm";

export const dynamic = "force-dynamic";

export default async function NewCouponPage() {
  await requireOwner();
  const products = await prisma.product.findMany({
    where: { active: true },
    select: {
      id: true,
      name: true,
      sku: true,
      costPerCarton: true,
      unitsPerCarton: true,
      unitPrice: true,
      cartonPrice: true,
      minMarginBps: true,
    },
    orderBy: [{ name: "asc" }],
  });

  return (
    <main className="mx-auto max-w-xl space-y-5 p-4 sm:p-6">
      <header>
        <Link
          href="/coupons"
          className="text-sm text-zinc-600 hover:underline"
        >
          ← Coupons
        </Link>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold">
          <Ticket className="h-6 w-6" strokeWidth={2} />
          New coupon
        </h1>
        <p className="text-sm text-zinc-600">
          Set the discount, share the code with the customer, the cashier
          types it at checkout.
        </p>
      </header>

      <CouponForm products={products} />
    </main>
  );
}
