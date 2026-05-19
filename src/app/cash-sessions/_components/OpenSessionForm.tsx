"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { openCashSession } from "@/lib/cash-sessions/actions";

export function OpenSessionForm() {
  const router = useRouter();
  const [openingFloat, setOpeningFloat] = useState(0);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [idempotencyKey, setIdempotencyKey] = useState(() =>
    crypto.randomUUID(),
  );

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const r = await openCashSession(idempotencyKey, {
        openingFloat,
        note,
      });
      if (!r.ok) {
        setError(r.error);
        setIdempotencyKey(crypto.randomUUID());
        return;
      }
      router.push(`/cash-sessions/${r.data.id}`);
    });
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4">
      <h2 className="text-lg font-medium">Open till</h2>
      <p className="mt-1 text-sm text-zinc-600">
        Count the cash in the till and enter it as the opening float.
      </p>

      {error && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mt-4 space-y-3">
        <label className="block">
          <span className="text-sm font-medium">Opening float (RWF)</span>
          <input
            type="number"
            min={0}
            step={1}
            value={openingFloat}
            onChange={(e) => setOpeningFloat(Number(e.target.value || 0))}
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium">Note (optional)</span>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. morning shift"
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
        </label>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={isPending}
          className="w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
        >
          {isPending ? "Opening..." : "Open till"}
        </button>
      </div>
    </div>
  );
}
