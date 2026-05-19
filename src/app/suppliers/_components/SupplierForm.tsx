"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Supplier } from "@prisma/client";
import { createSupplier, updateSupplier } from "@/lib/suppliers/actions";

type Mode =
  | { kind: "create" }
  | { kind: "edit"; id: string; supplier: Supplier };

export function SupplierForm({ mode }: { mode: Mode }) {
  const router = useRouter();

  const initial =
    mode.kind === "edit"
      ? {
          name: mode.supplier.name,
          phone: mode.supplier.phone ?? "",
          notes: mode.supplier.notes ?? "",
        }
      : { name: "", phone: "", notes: "" };

  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [idempotencyKey, setIdempotencyKey] = useState(() =>
    crypto.randomUUID(),
  );

  function handleSubmit(formData: FormData) {
    setError(null);

    const data = {
      name: String(formData.get("name") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      notes: String(formData.get("notes") ?? ""),
    };

    startTransition(async () => {
      const result =
        mode.kind === "create"
          ? await createSupplier(idempotencyKey, data)
          : await updateSupplier(idempotencyKey, mode.id, data);

      if (!result.ok) {
        setError(result.error);
        setIdempotencyKey(crypto.randomUUID());
        return;
      }

      if (mode.kind === "create") {
        router.push(`/suppliers/${result.data.id}`);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <label className="block">
        <span className="text-sm font-medium">Name</span>
        <input
          type="text"
          name="name"
          required
          defaultValue={initial.name}
          placeholder="e.g. Bralirwa, Inyange Industries"
          className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium">Phone (optional)</span>
        <input
          type="tel"
          name="phone"
          defaultValue={initial.phone}
          placeholder="+250788000000"
          className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium">Notes (optional)</span>
        <textarea
          name="notes"
          defaultValue={initial.notes}
          rows={4}
          placeholder="Payment terms, delivery cadence, contact person, etc."
          className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
        />
      </label>

      <div className="flex gap-2 pt-2">
        <Link
          href="/suppliers"
          className="flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-center text-sm font-medium hover:bg-zinc-50"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={isPending}
          className="flex-1 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
        >
          {isPending
            ? "Saving..."
            : mode.kind === "create"
              ? "Create supplier"
              : "Save changes"}
        </button>
      </div>
    </form>
  );
}
