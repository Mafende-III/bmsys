import Link from "next/link";
import { requireOwner } from "@/lib/auth-guards";
import { formatRWF } from "@/lib/format";
import { getOpenSession, listSessions } from "@/lib/cash-sessions/queries";
import { OpenSessionForm } from "./_components/OpenSessionForm";

export default async function CashSessionsPage() {
  await requireOwner();

  const [open, history] = await Promise.all([
    getOpenSession(),
    listSessions(50),
  ]);

  return (
    <main className="mx-auto max-w-3xl p-4 sm:p-6">
      <header className="mb-4">
        <Link
          href="/dashboard"
          className="text-sm text-zinc-600 hover:underline"
        >
          ← Dashboard
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">Cash sessions</h1>
        <p className="text-sm text-zinc-600">
          Open the till with the float, close with the count.
        </p>
      </header>

      {open ? (
        <section className="mb-6 rounded-2xl border border-green-200 bg-green-50 p-4">
          <p className="text-xs uppercase tracking-wide text-green-700">
            Open
          </p>
          <p className="mt-1 text-lg font-medium text-green-900">
            Till open since {new Date(open.openedAt).toLocaleString()}
          </p>
          <dl className="mt-3 grid grid-cols-2 gap-y-1 text-sm text-green-900">
            <dt>Opening float</dt>
            <dd className="text-right font-mono tabular-nums">
              {formatRWF(open.openingFloat)}
            </dd>
            <dt>
              Cash sales so far ({open.cashSalesCount}{" "}
              {open.cashSalesCount === 1 ? "sale" : "sales"})
            </dt>
            <dd className="text-right font-mono tabular-nums">
              {formatRWF(open.cashSalesTotal)}
            </dd>
          </dl>
          <Link
            href={`/cash-sessions/${open.id}`}
            className="mt-4 inline-block rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          >
            View / close →
          </Link>
        </section>
      ) : (
        <section className="mb-6">
          <OpenSessionForm />
        </section>
      )}

      <section>
        <h2 className="text-lg font-medium">History</h2>
        <div className="mt-2 overflow-hidden rounded-2xl border border-zinc-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs font-medium uppercase text-zinc-600">
              <tr>
                <th className="px-3 py-2">Opened</th>
                <th className="px-3 py-2">Closed</th>
                <th className="px-3 py-2 text-right">Float</th>
                <th className="px-3 py-2 text-right">Counted</th>
                <th className="px-3 py-2 text-right">Variance</th>
              </tr>
            </thead>
            <tbody>
              {history.map((s) => (
                <tr key={s.id} className="border-t border-zinc-200 hover:bg-zinc-50">
                  <td className="px-3 py-2 text-xs">
                    <Link
                      href={`/cash-sessions/${s.id}`}
                      className="text-zinc-900 hover:underline"
                    >
                      {new Date(s.openedAt).toLocaleString()}
                    </Link>
                    <p className="text-[10px] text-zinc-500">
                      by {s.openedBy.name}
                    </p>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {s.closedAt ? (
                      <>
                        {new Date(s.closedAt).toLocaleString()}
                        <p className="text-[10px] text-zinc-500">
                          by {s.closedBy?.name ?? "—"}
                        </p>
                      </>
                    ) : (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] uppercase text-green-800">
                        Open
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xs tabular-nums">
                    {formatRWF(s.openingFloat)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xs tabular-nums">
                    {s.closingCount !== null
                      ? formatRWF(s.closingCount)
                      : "—"}
                  </td>
                  <td
                    className={`px-3 py-2 text-right font-mono text-xs tabular-nums ${
                      s.variance == null
                        ? ""
                        : s.variance === 0
                          ? "text-green-700"
                          : s.variance > 0
                            ? "text-amber-700"
                            : "text-red-700"
                    }`}
                  >
                    {s.variance == null
                      ? "—"
                      : `${s.variance > 0 ? "+" : ""}${formatRWF(s.variance)}`}
                  </td>
                </tr>
              ))}
              {history.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-3 py-6 text-center text-zinc-500"
                  >
                    No sessions yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
