"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { runRecurringNow } from "@/lib/expenses/actions";

export function RunRecurringButton() {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [idempotencyKey, setIdempotencyKey] = useState(() =>
    crypto.randomUUID(),
  );

  function handleClick() {
    setMsg(null);
    startTransition(async () => {
      const r = await runRecurringNow(idempotencyKey);
      if (!r.ok) {
        setMsg(`Error: ${r.error}`);
      } else if (r.data.created === 0) {
        setMsg("Nothing due today (or already ran).");
      } else {
        setMsg(
          `Created ${r.data.created} expense${r.data.created === 1 ? "" : "s"} from due recurring entries.`,
        );
      }
      setIdempotencyKey(crypto.randomUUID());
      router.refresh();
    });
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4">
      <p className="text-sm font-medium">Run due recurring now</p>
      <p className="mt-1 text-xs text-zinc-600">
        Until pg-boss is wired, this button does what the nightly job will
        do: create an expense row for each active recurring entry whose
        day-of-period matches today and which hasn&apos;t already run today.
      </p>
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="mt-3 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
      >
        {isPending ? "Running..." : "Run now"}
      </button>
      {msg && (
        <p className="mt-2 text-xs text-zinc-700">{msg}</p>
      )}
    </div>
  );
}
