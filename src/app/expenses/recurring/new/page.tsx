import { getTranslations } from "next-intl/server";
import { requireOwner } from "@/lib/auth-guards";
import { listExpenseCategories } from "@/lib/expenses/queries";
import { RecurringForm } from "../../_components/RecurringForm";

export default async function NewRecurringPage() {
  await requireOwner();

  const categories = await listExpenseCategories();
  const t = await getTranslations("expenses.recurring");

  return (
    <main className="mx-auto max-w-2xl space-y-3 p-4">
      <header>
        <h1 className="text-xl font-bold text-ink">{t("newTitle")}</h1>
        <p className="text-[13px] text-ink-2">{t("newSubtitle")}</p>
      </header>
      <RecurringForm mode={{ kind: "create" }} categories={categories} />
    </main>
  );
}
