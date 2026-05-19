"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { upsertRecurring } from "@/lib/expenses/actions";
import {
  RECURRING_FREQUENCIES,
  type RecurringFrequency,
} from "@/lib/expenses/schema";

type CategoryOption = { id: string; name: string };

type Mode =
  | { kind: "create" }
  | {
      kind: "edit";
      id: string;
      initial: {
        categoryId: string;
        amount: number;
        description: string;
        frequency: RecurringFrequency;
        dayOfPeriod: number;
        active: boolean;
      };
    };

const WEEKDAYS = [
  "Sunday (0)",
  "Monday (1)",
  "Tuesday (2)",
  "Wednesday (3)",
  "Thursday (4)",
  "Friday (5)",
  "Saturday (6)",
];

export function RecurringForm({
  mode,
  categories,
}: {
  mode: Mode;
  categories: CategoryOption[];
}) {
  const router = useRouter();

  const initial =
    mode.kind === "edit"
      ? mode.initial
      : {
          categoryId: categories[0]?.id ?? "",
          amount: 0,
          description: "",
          frequency: "MONTHLY" as RecurringFrequency,
          dayOfPeriod: 1,
          active: true,
        };

  const [categoryId, setCategoryId] = useState(initial.categoryId);
  const [amount, setAmount] = useState(initial.amount);
  const [description, setDescription] = useState(initial.description);
  const [frequency, setFrequency] = useState<RecurringFrequency>(
    initial.frequency,
  );
  const [dayOfPeriod, setDayOfPeriod] = useState(initial.dayOfPeriod);
  const [active, setActive] = useState(initial.active);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [idempotencyKey, setIdempotencyKey] = useState(() =>
    crypto.randomUUID(),
  );

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const r = await upsertRecurring(
        idempotencyKey,
        mode.kind === "edit" ? mode.id : null,
        {
          categoryId,
          amount,
          description,
          frequency,
          dayOfPeriod,
          active,
        },
      );
      if (!r.ok) {
        setError(r.error);
        setIdempotencyKey(crypto.randomUUID());
        return;
      }
      router.push("/expenses/recurring");
    });
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <label className="block">
        <span className="text-sm font-medium">Description</span>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. Monthly rent, Weekly waste collection"
          className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-sm font-medium">Amount (RWF)</span>
          <input
            type="number"
            min={1}
            step={1}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value || 0))}
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-lg font-mono tabular-nums"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Category</span>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-sm font-medium">Frequency</span>
          <select
            value={frequency}
            onChange={(e) => {
              const f = e.target.value as RecurringFrequency;
              setFrequency(f);
              setDayOfPeriod(f === "MONTHLY" ? 1 : 0);
            }}
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          >
            {RECURRING_FREQUENCIES.map((f) => (
              <option key={f} value={f}>
                {f === "MONTHLY" ? "Monthly" : "Weekly"}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-medium">
            {frequency === "MONTHLY" ? "Day of month (1-31)" : "Day of week"}
          </span>
          {frequency === "WEEKLY" ? (
            <select
              value={dayOfPeriod}
              onChange={(e) => setDayOfPeriod(Number(e.target.value))}
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            >
              {WEEKDAYS.map((label, i) => (
                <option key={i} value={i}>
                  {label}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="number"
              min={1}
              max={31}
              step={1}
              value={dayOfPeriod}
              onChange={(e) =>
                setDayOfPeriod(
                  Math.min(31, Math.max(1, Number(e.target.value || 1))),
                )
              }
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-mono tabular-nums"
            />
          )}
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
          className="h-4 w-4 rounded border-zinc-300"
        />
        Active (auto-creates expenses on schedule)
      </label>

      <div className="flex gap-2 pt-2">
        <Link
          href="/expenses/recurring"
          className="flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-center text-sm font-medium hover:bg-zinc-50"
        >
          Cancel
        </Link>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isPending || amount <= 0 || description.trim() === ""}
          className="flex-1 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
        >
          {isPending
            ? "Saving..."
            : mode.kind === "create"
              ? "Create recurring"
              : "Save changes"}
        </button>
      </div>
    </div>
  );
}
