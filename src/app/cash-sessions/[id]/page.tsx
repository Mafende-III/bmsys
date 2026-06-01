import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSeller } from "@/lib/auth-guards";
import { describeVariance } from "@/lib/copy";
import { formatRWF } from "@/lib/format";
import { getSession } from "@/lib/cash-sessions/queries";
import { CloseSessionForm } from "../_components/CloseSessionForm";

export default async function CashSessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSeller();

  const { id } = await params;
  const session = await getSession(id);
  if (!session) notFound();

  const isOpen = session.closedAt === null;

  return (
    <main className="mx-auto max-w-2xl p-4 sm:p-6">
      <header className="mb-4">
        <Link
          href="/cash-sessions"
          className="text-sm text-zinc-600 hover:underline"
        >
          ← Cash sessions
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">
          {isOpen ? "Open till" : "Closed till"}
        </h1>
        <p className="text-sm text-zinc-600">
          Opened {new Date(session.openedAt).toLocaleString()} by{" "}
          {session.openedBy.name}
        </p>
      </header>

      <section className="rounded-2xl border border-zinc-200 bg-white p-4">
        <dl className="grid grid-cols-2 gap-y-1 text-sm">
          <dt className="text-zinc-600">Opening float</dt>
          <dd className="text-right font-mono tabular-nums">
            {formatRWF(session.openingFloat)}
          </dd>
          <dt className="text-zinc-600">
            Cash sales ({session.cashSalesCount}{" "}
            {session.cashSalesCount === 1 ? "sale" : "sales"})
          </dt>
          <dd className="text-right font-mono tabular-nums">
            {formatRWF(session.cashSalesTotal)}
          </dd>
          {session.expectedCash !== null && (
            <>
              <dt className="text-zinc-600">Expected cash</dt>
              <dd className="text-right font-mono tabular-nums">
                {formatRWF(session.expectedCash)}
              </dd>
              <dt className="text-zinc-600">Counted</dt>
              <dd className="text-right font-mono tabular-nums">
                {formatRWF(session.closingCount ?? 0)}
              </dd>
              <dt className="font-medium text-zinc-800">Result</dt>
              <dd
                className={`text-right font-medium ${
                  session.variance === 0
                    ? "text-green-700"
                    : (session.variance ?? 0) > 0
                      ? "text-amber-700"
                      : "text-red-700"
                }`}
              >
                {describeVariance(session.variance ?? 0).label}
                {(session.variance ?? 0) !== 0 && (
                  <>
                    {" — "}
                    <span className="font-mono tabular-nums">
                      {formatRWF(Math.abs(session.variance ?? 0))} RWF
                    </span>
                  </>
                )}
              </dd>
            </>
          )}
        </dl>
        {session.note && (
          <p className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-700">
            {session.note}
          </p>
        )}
        {session.closedAt && (
          <p className="mt-3 text-xs text-zinc-500">
            Closed {new Date(session.closedAt).toLocaleString()} by{" "}
            {session.closedBy?.name ?? "—"}
          </p>
        )}
      </section>

      {isOpen && (
        <section className="mt-6">
          <CloseSessionForm
            sessionId={session.id}
            openingFloat={session.openingFloat}
            cashSalesTotal={session.cashSalesTotal}
          />
        </section>
      )}
    </main>
  );
}
