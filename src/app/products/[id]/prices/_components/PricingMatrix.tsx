"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Channel, ChannelPriceOverride, Product } from "@prisma/client";
import { formatRWF } from "@/lib/format";
import { saveChannelPrices } from "@/lib/channel-prices/actions";

type Row = {
  channel: Channel;
  override: ChannelPriceOverride | null;
  effectiveUnitPrice: number;
  effectiveCartonPrice: number;
};

type State = {
  channelId: string;
  unit: string; // raw input value; "" means "no override"
  carton: string;
};

function rowsToState(rows: Row[]): State[] {
  return rows.map((r) => ({
    channelId: r.channel.id,
    unit: r.override?.unitPrice != null ? String(r.override.unitPrice) : "",
    carton:
      r.override?.cartonPrice != null ? String(r.override.cartonPrice) : "",
  }));
}

function parseInput(v: string): number | null {
  const trimmed = v.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

export function PricingMatrix({
  product,
  rows,
}: {
  product: Product;
  rows: Row[];
}) {
  const router = useRouter();
  const initial = useMemo(() => rowsToState(rows), [rows]);
  const [state, setState] = useState<State[]>(initial);
  const [error, setError] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [idempotencyKey, setIdempotencyKey] = useState(() =>
    crypto.randomUUID(),
  );

  function update(channelId: string, field: "unit" | "carton", value: string) {
    setState((prev) =>
      prev.map((s) => (s.channelId === channelId ? { ...s, [field]: value } : s)),
    );
    setSavedNote(null);
  }

  function handleSubmit() {
    setError(null);
    setSavedNote(null);

    const overrides = state.map((s) => ({
      channelId: s.channelId,
      unitPrice: parseInput(s.unit),
      cartonPrice: parseInput(s.carton),
    }));

    startTransition(async () => {
      const result = await saveChannelPrices(idempotencyKey, {
        productId: product.id,
        overrides,
      });

      if (!result.ok) {
        setError(result.error);
        setIdempotencyKey(crypto.randomUUID());
        return;
      }

      setSavedNote(
        result.data.changed === 0
          ? "No changes to save."
          : `Saved ${result.data.changed} change${result.data.changed === 1 ? "" : "s"}.`,
      );
      setIdempotencyKey(crypto.randomUUID());
      router.refresh();
    });
  }

  return (
    <form
      action={handleSubmit}
      className="space-y-4"
    >
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {savedNote && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {savedNote}
        </div>
      )}

      <div className="rounded-lg border border-zinc-200 bg-white p-4 text-sm">
        <p className="font-medium text-zinc-800">Defaults (no override)</p>
        <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-zinc-700">
          <dt>Unit price</dt>
          <dd className="text-right font-mono">
            {formatRWF(product.unitPrice)}
          </dd>
          <dt>Carton price</dt>
          <dd className="text-right font-mono">
            {formatRWF(product.cartonPrice)}
          </dd>
        </dl>
        <p className="mt-2 text-xs text-zinc-500">
          Leave a cell blank to keep the default for that channel.
        </p>
      </div>

      {/* Desktop matrix */}
      <div className="hidden overflow-hidden rounded-2xl border border-zinc-200 bg-white sm:block">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs font-medium uppercase text-zinc-600">
            <tr>
              <th className="px-3 py-2">Channel</th>
              <th className="px-3 py-2">Unit price override</th>
              <th className="px-3 py-2">Carton price override</th>
              <th className="px-3 py-2 text-right">Effective unit</th>
              <th className="px-3 py-2 text-right">Effective carton</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const s = state[i] ?? {
                channelId: row.channel.id,
                unit: "",
                carton: "",
              };
              const unitN = parseInput(s.unit);
              const cartonN = parseInput(s.carton);
              const effUnit = unitN ?? product.unitPrice;
              const effCarton = cartonN ?? product.cartonPrice;
              return (
                <tr key={row.channel.id} className="border-t border-zinc-200">
                  <td className="px-3 py-2">
                    <span
                      className={
                        row.channel.active ? "" : "text-zinc-400 line-through"
                      }
                    >
                      {row.channel.name}
                    </span>
                    {!row.channel.active && (
                      <span className="ml-2 rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-zinc-500">
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min={0}
                      step={1}
                      inputMode="numeric"
                      value={s.unit}
                      onChange={(e) =>
                        update(row.channel.id, "unit", e.target.value)
                      }
                      placeholder={String(product.unitPrice)}
                      className="block w-32 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min={0}
                      step={1}
                      inputMode="numeric"
                      value={s.carton}
                      onChange={(e) =>
                        update(row.channel.id, "carton", e.target.value)
                      }
                      placeholder={String(product.cartonPrice)}
                      className="block w-32 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
                    />
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xs text-zinc-700">
                    {formatRWF(effUnit)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xs text-zinc-700">
                    {formatRWF(effCarton)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile stacked cards */}
      <div className="space-y-3 sm:hidden">
        {rows.map((row, i) => {
          const s = state[i] ?? {
            channelId: row.channel.id,
            unit: "",
            carton: "",
          };
          const unitN = parseInput(s.unit);
          const cartonN = parseInput(s.carton);
          return (
            <div
              key={row.channel.id}
              className="rounded-2xl border border-zinc-200 bg-white p-3"
            >
              <div className="flex items-center justify-between">
                <p
                  className={
                    row.channel.active ? "font-medium" : "font-medium text-zinc-400 line-through"
                  }
                >
                  {row.channel.name}
                </p>
                {!row.channel.active && (
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500">
                    Inactive
                  </span>
                )}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="text-xs text-zinc-600">Unit override</span>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    inputMode="numeric"
                    value={s.unit}
                    onChange={(e) =>
                      update(row.channel.id, "unit", e.target.value)
                    }
                    placeholder={String(product.unitPrice)}
                    className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                  />
                  <span className="mt-1 block text-[11px] text-zinc-500">
                    eff. {formatRWF(unitN ?? product.unitPrice)}
                  </span>
                </label>
                <label className="block">
                  <span className="text-xs text-zinc-600">
                    Carton override
                  </span>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    inputMode="numeric"
                    value={s.carton}
                    onChange={(e) =>
                      update(row.channel.id, "carton", e.target.value)
                    }
                    placeholder={String(product.cartonPrice)}
                    className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                  />
                  <span className="mt-1 block text-[11px] text-zinc-500">
                    eff. {formatRWF(cartonN ?? product.cartonPrice)}
                  </span>
                </label>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex gap-2 pt-2">
        <Link
          href={`/products/${product.id}`}
          className="flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-center text-sm font-medium hover:bg-zinc-50"
        >
          Back to product
        </Link>
        <button
          type="submit"
          disabled={isPending}
          className="flex-1 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
        >
          {isPending ? "Saving..." : "Save prices"}
        </button>
      </div>
    </form>
  );
}
