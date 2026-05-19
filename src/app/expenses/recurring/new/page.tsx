import Link from "next/link";
import { requireOwner } from "@/lib/auth-guards";
import { listExpenseCategories } from "@/lib/expenses/queries";
import { RecurringForm } from "../../_components/RecurringForm";

export default async function NewRecurringPage() {
  await requireOwner();

  const categories = await listExpenseCategories();

  return (
    <main className="mx-auto max-w-xl p-4 sm:p-6">
      <header className="mb-4">
        <Link
          href="/expenses/recurring"
          className="text-sm text-zinc-600 hover:underline"
        >
          ← Recurring
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">New recurring expense</h1>
        <p className="text-sm text-zinc-600">
          Auto-creates an expense row on schedule. Edit or deactivate later.
        </p>
      </header>
      <RecurringForm mode={{ kind: "create" }} categories={categories} />
    </main>
  );
}
