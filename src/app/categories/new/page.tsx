import Link from "next/link";
import { requireOwner } from "@/lib/auth-guards";
import { CategoryForm } from "../_components/CategoryForm";

export default async function NewCategoryPage() {
  await requireOwner();

  return (
    <main className="mx-auto max-w-xl p-4 sm:p-6">
      <header className="mb-4">
        <Link
          href="/categories"
          className="text-sm text-zinc-600 hover:underline"
        >
          ← Categories
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">New category</h1>
        <p className="text-sm text-zinc-600">
          A grouping for the /sell grid. The icon is shown on the POS tile.
        </p>
      </header>
      <CategoryForm mode={{ kind: "create" }} />
    </main>
  );
}
