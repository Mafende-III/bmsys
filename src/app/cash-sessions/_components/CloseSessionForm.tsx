"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { closeCashSession } from "@/lib/cash-sessions/actions";
import { describeVariance } from "@/lib/copy";
import { formatRWF } from "@/lib/format";

export function CloseSessionForm({
  sessionId,
  openingFloat,
  cashSalesTotal,
}: {
  sessionId: string;
  openingFloat: number;
  cashSalesTotal: number;
}) {
  const router = useRouter();
  const [closingCount, setClosingCount] = useState(
    openingFloat + cashSalesTotal,
  );
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [idempotencyKey, setIdempotencyKey] = useState(() =>
    crypto.randomUUID(),
  );

  const expected = openingFloat + cashSalesTotal;
  const variance = useMemo(
    () => closingCount - expected,
    [closingCount, expected],
  );

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const r = await closeCashSession(idempotencyKey, sessionId, {
        closingCount,
        note,
      });
      if (!r.ok) {
        setError(r.error);
        setIdempotencyKey(crypto.randomUUID());
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4">
      <h2 className="text-lg font-medium">Close till</h2>

      {error && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <dl className="mt-4 grid grid-cols-2 gap-y-1 text-sm">
        <dt className="text-zinc-600">Opening float</dt>
        <dd className="text-right font-mono tabular-nums">
          {formatRWF(openingFloat)}
        </dd>
        <dt className="text-zinc-600">Cash sales (so far)</dt>
        <dd className="text-right font-mono tabular-nums">
          {formatRWF(cashSalesTotal)}
        </dd>
        <dt className="font-medium text-zinc-800">Expected cash</dt>
        <dd className="text-right font-mono font-medium tabular-nums">
          {formatRWF(expected)}
        </dd>
      </dl>

      <div className="mt-4 space-y-3">
        <label className="block">
          <span className="text-sm font-medium">Counted cash (RWF)</span>
          <input
            type="number"
            min={0}
            step={1}
            value={closingCount}
            onChange={(e) => setClosingCount(Number(e.target.value || 0))}
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-lg font-mono tabular-nums focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
          />
        </label>

        <VarianceCallout variance={variance} />

        <label className="block">
          <span className="text-sm font-medium">Note (optional)</span>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="explain a variance if any"
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
        </label>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={isPending}
          className="w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
        >
          {isPending ? "Closing..." : "Close till"}
        </button>
      </div>
    </div>
  );
}

function VarianceCallout({ variance }: { variance: number }) {
  const { tone, label, sentence } = describeVariance(variance);
  const styles =
    tone === "balanced"
      ? "border-green-200 bg-green-50 text-green-800"
      : tone === "over"
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : "border-red-200 bg-red-50 text-red-700";
  return (
    <div className={`rounded-lg border px-4 py-3 text-sm ${styles}`}>
      <span className="font-semibold">{label}</span>{" "}
      <span>{sentence}</span>
    </div>
  );
}
