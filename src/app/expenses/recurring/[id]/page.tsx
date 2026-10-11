import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
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
  const t = await getTranslations("expenses.recurring");

  return (
    <main className="mx-auto max-w-2xl space-y-3 p-4">
      <header>
        <h1 className="text-xl font-bold text-ink">{r.description}</h1>
        <p className="text-[13px] text-ink-2">
          {r.category.name} ·{" "}
          {r.frequency === "WEEKLY" ? t("weekly") : t("monthly")}
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
