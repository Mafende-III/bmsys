import Link from "next/link";
import { requireOwner } from "@/lib/auth-guards";
import { formatRWF } from "@/lib/format";
import { listRecurring } from "@/lib/expenses/queries";
import { RunRecurringButton } from "../_components/RunRecurringButton";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function describeSchedule(frequency: string, day: number): string {
  if (frequency === "WEEKLY") return `Every ${WEEKDAYS[day] ?? "?"}`;
  return `On day ${day} of each month`;
}

export default async function RecurringPage() {
  await requireOwner();

  const rows = await listRecurring();

  return (
    <main className="mx-auto max-w-4xl p-4 sm:p-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href="/expenses"
            className="text-sm text-zinc-600 hover:underline"
          >
            ← Expenses
          </Link>
          <h1 className="mt-1 text-2xl font-semibold">Recurring expenses</h1>
          <p className="text-sm text-zinc-600">
            {rows.length} {rows.length === 1 ? "entry" : "entries"} (weekly /
            monthly auto-create)
          </p>
        </div>
        <Link
          href="/expenses/recurring/new"
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
        >
          + New recurring
        </Link>
      </header>

      <div className="mt-4">
        <RunRecurringButton />
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-zinc-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs font-medium uppercase text-zinc-600">
            <tr>
              <th className="px-3 py-2">Description</th>
              <th className="px-3 py-2">Category</th>
              <th className="px-3 py-2 text-right">Amount</th>
              <th className="px-3 py-2">Schedule</th>
              <th className="px-3 py-2">Last run</th>
              <th className="px-3 py-2 text-right">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                className="border-t border-zinc-200 hover:bg-zinc-50"
              >
                <td className="px-3 py-2">
                  <Link
                    href={`/expenses/recurring/${r.id}`}
                    className="font-medium text-zinc-900 hover:underline"
                  >
                    {r.description}
                  </Link>
                  <p className="text-[10px] text-zinc-500">
                    {r._count.expenses}{" "}
                    {r._count.expenses === 1 ? "expense" : "expenses"} created
                  </p>
                </td>
                <td className="px-3 py-2 text-xs">{r.category.name}</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">
                  {formatRWF(r.amount)}
                </td>
                <td className="px-3 py-2 text-xs">
                  {describeSchedule(r.frequency, r.dayOfPeriod)}
                </td>
                <td className="px-3 py-2 text-xs text-zinc-600">
                  {r.lastRunAt
                    ? new Date(r.lastRunAt).toLocaleDateString()
                    : "—"}
                </td>
                <td className="px-3 py-2 text-right">
                  {r.active ? (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] text-green-800">
                      Active
                    </span>
                  ) : (
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] text-zinc-700">
                      Inactive
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-zinc-500">
                  No recurring entries yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
