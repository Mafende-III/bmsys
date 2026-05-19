import Link from "next/link";
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

  return (
    <main className="mx-auto max-w-xl p-4 sm:p-6">
      <header className="mb-4">
        <Link
          href="/expenses"
          className="text-sm text-zinc-600 hover:underline"
        >
          ← Expenses
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">New expense</h1>
        <p className="text-sm text-zinc-600">
          Rent, salaries, transport, utilities — anything that's not stock.
        </p>
      </header>
      <ExpenseForm categories={categories} suppliers={suppliers} />
    </main>
  );
}
