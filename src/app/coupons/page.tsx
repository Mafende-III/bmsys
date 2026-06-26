import Link from "next/link";
import { Plus, Ticket } from "lucide-react";
import { requireOwner } from "@/lib/auth-guards";
import { listCoupons } from "@/lib/coupons/queries";
import { CouponList } from "./_components/CouponList";

export const dynamic = "force-dynamic";

export default async function CouponsPage() {
  await requireOwner();
  const coupons = await listCoupons(100);

  return (
    <main className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <Link
            href="/dashboard"
            className="text-sm text-zinc-600 hover:underline"
          >
            ← Dashboard
          </Link>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold">
            <Ticket className="h-6 w-6" strokeWidth={2} />
            Coupons
          </h1>
          <p className="text-sm text-zinc-600">
            Issue one-time-use discount codes. Share the code (WhatsApp,
            written slip); the cashier types it at checkout.
          </p>
        </div>
        <Link
          href="/coupons/new"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-zinc-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-zinc-800"
        >
          <Plus className="h-4 w-4" strokeWidth={2} />
          New coupon
        </Link>
      </header>

      <CouponList coupons={coupons} />
    </main>
  );
}
