import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/auth-guards";
import {
  getRecurring,
  listExpenseCategories,
} from "@/lib/expenses/queries";
import { RecurringForm } from "../../_components/RecurringForm";

export default async function EditRecurringPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireOwner();

  const { id } = await params;
  const [r, categories] = await Promise.all([
    getRecurring(id),
    listExpenseCategories(),
  ]);

  if (!r) notFound();

  return (
    <main className="mx-auto max-w-xl p-4 sm:p-6">
      <header className="mb-4">
        <Link
          href="/expenses/recurring"
          className="text-sm text-zinc-600 hover:underline"
        >
          ← Recurring
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">{r.description}</h1>
        <p className="text-sm text-zinc-600">
          {r.category.name} · {r.frequency}
        </p>
      </header>
      <RecurringForm
        mode={{
          kind: "edit",
          id: r.id,
          initial: {
            categoryId: r.categoryId,
            amount: r.amount,
            description: r.description,
            frequency: r.frequency,
            dayOfPeriod: r.dayOfPeriod,
            active: r.active,
          },
        }}
        categories={categories}
      />
    </main>
  );
}
