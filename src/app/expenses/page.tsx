import Link from "next/link";
import { requireOwner } from "@/lib/auth-guards";
import { formatRWF } from "@/lib/format";
import {
  listExpenseCategories,
  listExpenses,
} from "@/lib/expenses/queries";

const methodBadge: Record<string, string> = {
  CASH: "bg-amber-100 text-amber-800",
  MOMO: "bg-indigo-100 text-indigo-800",
  BANK: "bg-zinc-100 text-zinc-800",
};

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ categoryId?: string; paymentMethod?: string }>;
}) {
  await requireOwner();

  const sp = await searchParams;
  const categoryId = sp.categoryId || undefined;
  const paymentMethod =
    sp.paymentMethod === "CASH" ||
    sp.paymentMethod === "MOMO" ||
    sp.paymentMethod === "BANK"
      ? sp.paymentMethod
      : ("all" as const);

  const [categories, expenses] = await Promise.all([
    listExpenseCategories(),
    listExpenses({ categoryId, paymentMethod }),
  ]);

  const totalShown = expenses.reduce((s, e) => s + e.amount, 0);

  return (
    <main className="mx-auto max-w-5xl p-4 sm:p-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href="/dashboard"
            className="text-sm text-zinc-600 hover:underline"
          >
            ← Dashboard
          </Link>
          <h1 className="mt-1 text-2xl font-semibold">Expenses</h1>
          <p className="text-sm text-zinc-600">
            {expenses.length}{" "}
            {expenses.length === 1 ? "expense" : "expenses"} ·{" "}
            {formatRWF(totalShown)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/expenses/recurring"
            className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium hover:bg-zinc-50"
          >
            Recurring →
          </Link>
          <Link
            href="/expenses/new"
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          >
            + New expense
          </Link>
        </div>
      </header>

      <form method="get" className="mt-4 flex gap-2">
        <label className="block">
          <span className="text-xs font-medium text-zinc-700">Category</span>
          <select
            name="categoryId"
            defaultValue={categoryId ?? ""}
            className="mt-1 block rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          >
            <option value="">All</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-medium text-zinc-700">Method</span>
          <select
            name="paymentMethod"
            defaultValue={paymentMethod === "all" ? "" : paymentMethod}
            className="mt-1 block rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          >
            <option value="">All</option>
            <option value="CASH">Cash</option>
            <option value="MOMO">MoMo</option>
            <option value="BANK">Bank</option>
          </select>
        </label>
        <button
          type="submit"
          className="self-end rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium hover:bg-zinc-50"
        >
          Filter
        </button>
      </form>

      <div className="mt-4 overflow-x-auto rounded-2xl border border-zinc-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs font-medium uppercase text-zinc-600">
            <tr>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Category</th>
              <th className="px-3 py-2">Description</th>
              <th className="px-3 py-2">Method</th>
              <th className="px-3 py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((e) => (
              <tr key={e.id} className="border-t border-zinc-200 hover:bg-zinc-50">
                <td className="px-3 py-2 text-xs text-zinc-700">
                  {new Date(e.date).toLocaleDateString()}
                </td>
                <td className="px-3 py-2 text-xs">{e.category.name}</td>
                <td className="px-3 py-2">
                  {e.description}
                  {e.supplier && (
                    <p className="text-[10px] text-zinc-500">
                      {e.supplier.name}
                    </p>
                  )}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] uppercase ${methodBadge[e.paymentMethod] ?? ""}`}
                  >
                    {e.paymentMethod}
                  </span>
                </td>
                <td className="px-3 py-2 text-right font-mono text-sm tabular-nums">
                  {formatRWF(e.amount)}
                </td>
              </tr>
            ))}
            {expenses.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-zinc-500">
                  No expenses match. Try clearing the filters, or log one above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
