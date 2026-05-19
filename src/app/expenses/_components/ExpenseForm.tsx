"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createExpense } from "@/lib/expenses/actions";
import {
  PAYMENT_METHODS,
  type ExpensePaymentMethod,
} from "@/lib/expenses/schema";

type CategoryOption = { id: string; name: string };
type SupplierOption = { id: string; name: string };

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function ExpenseForm({
  categories,
  suppliers,
}: {
  categories: CategoryOption[];
  suppliers: SupplierOption[];
}) {
  const router = useRouter();

  const [date, setDate] = useState(todayISO());
  const [amount, setAmount] = useState(0);
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [description, setDescription] = useState("");
  const [paymentMethod, setPaymentMethod] =
    useState<ExpensePaymentMethod>("CASH");
  const [paymentReference, setPaymentReference] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [idempotencyKey, setIdempotencyKey] = useState(() =>
    crypto.randomUUID(),
  );

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const r = await createExpense(idempotencyKey, {
        date,
        amount,
        categoryId,
        description,
        paymentMethod,
        paymentReference: paymentReference || undefined,
        supplierId: supplierId || undefined,
      });
      if (!r.ok) {
        setError(r.error);
        setIdempotencyKey(crypto.randomUUID());
        return;
      }
      router.push("/expenses");
    });
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-sm font-medium">Date</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Amount (RWF)</span>
          <input
            type="number"
            min={1}
            step={1}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value || 0))}
            required
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-lg font-mono tabular-nums"
          />
        </label>
      </div>

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

      <label className="block">
        <span className="text-sm font-medium">Description</span>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          placeholder="e.g. November rent, fuel for delivery bike"
          className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        />
      </label>

      <fieldset>
        <legend className="text-sm font-medium">Payment method</legend>
        <div className="mt-1 grid grid-cols-3 gap-2">
          {PAYMENT_METHODS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setPaymentMethod(m)}
              className={`rounded-2xl border px-3 py-3 text-sm font-medium transition ${
                paymentMethod === m
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : "border-zinc-300 bg-white hover:bg-zinc-50"
              }`}
            >
              {m === "CASH" ? "💵 Cash" : m === "MOMO" ? "📱 MoMo" : "🏦 Bank"}
            </button>
          ))}
        </div>
      </fieldset>

      {paymentMethod !== "CASH" && (
        <label className="block">
          <span className="text-sm font-medium">Reference (optional)</span>
          <input
            type="text"
            value={paymentReference}
            onChange={(e) => setPaymentReference(e.target.value)}
            placeholder="Txn id, MoMo code, bank ref"
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
        </label>
      )}

      <label className="block">
        <span className="text-sm font-medium">Supplier (optional)</span>
        <select
          value={supplierId}
          onChange={(e) => setSupplierId(e.target.value)}
          className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        >
          <option value="">— None —</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>

      <div className="flex gap-2 pt-2">
        <Link
          href="/expenses"
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
          {isPending ? "Recording..." : "Record expense"}
        </button>
      </div>
    </div>
  );
}
