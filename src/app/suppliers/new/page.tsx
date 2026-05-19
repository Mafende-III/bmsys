import Link from "next/link";
import { requireOwner } from "@/lib/auth-guards";
import { SupplierForm } from "../_components/SupplierForm";

export default async function NewSupplierPage() {
  await requireOwner();

  return (
    <main className="mx-auto max-w-xl p-4 sm:p-6">
      <header className="mb-4">
        <Link
          href="/suppliers"
          className="text-sm text-zinc-600 hover:underline"
        >
          ← Suppliers
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">New supplier</h1>
        <p className="text-sm text-zinc-600">
          A vendor you receive stock from.
        </p>
      </header>
      <SupplierForm mode={{ kind: "create" }} />
    </main>
  );
}
