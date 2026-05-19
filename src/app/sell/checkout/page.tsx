import Link from "next/link";
import { requireSeller } from "@/lib/auth-guards";
import { CheckoutForm } from "../_components/CheckoutForm";

export default async function CheckoutPage() {
  await requireSeller();

  return (
    <div>
      <div className="mb-3">
        <Link href="/sell" className="text-sm text-zinc-600 hover:underline">
          ← Back
        </Link>
        <h2 className="mt-1 text-xl font-semibold">Checkout</h2>
      </div>
      <CheckoutForm />
    </div>
  );
}
