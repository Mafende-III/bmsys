import Link from "next/link";
import { requireOwner } from "@/lib/auth-guards";
import { ProductForm } from "../_components/ProductForm";
import { getCategories } from "@/lib/products/queries";

export default async function NewProductPage() {
  await requireOwner();

  const categories = await getCategories();

  return (
    <main className="mx-auto max-w-2xl p-4 sm:p-6">
      <header className="mb-4">
        <Link
          href="/products"
          className="text-sm text-zinc-600 hover:underline"
        >
          ← Products
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">New product</h1>
        <p className="text-sm text-zinc-600">
          Add a beverage to the catalog.
        </p>
      </header>
      <ProductForm mode={{ kind: "create" }} categories={categories} />
    </main>
  );
}
