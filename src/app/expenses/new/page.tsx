import { getTranslations } from "next-intl/server";
import { requireOwner } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import { listExpenseCategories } from "@/lib/expenses/queries";
import { ExpenseForm } from "../_components/ExpenseForm";

export default async function NewExpensePage() {
  await requireOwner();

  const [categories, suppliers] = await Promise.all([
    listExpenseCategories(),
    prisma.supplier.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  const t = await getTranslations("expenses");

  return (
    <main className="mx-auto max-w-2xl space-y-3 p-4">
      <header>
        <h1 className="text-xl font-bold text-ink">{t("newTitle")}</h1>
        <p className="text-[13px] text-ink-2">{t("newSubtitle")}</p>
      </header>
      <ExpenseForm categories={categories} suppliers={suppliers} />
    </main>
  );
}
