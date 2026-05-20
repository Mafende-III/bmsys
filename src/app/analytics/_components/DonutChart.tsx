"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatRWF } from "@/lib/format";

export type DonutSlice = {
  id: string;
  label: string;
  value: number;
};

/**
 * Donut showing share of a total. Works for channels + expense
 * categories. Center label shows the chart total. Tooltip shows
 * the slice's absolute value + percentage. Palette is intentional
 * — picked to read well next to the rest of the dashboard chrome.
 */
const PALETTE = [
  "#18181b", // zinc-900 — primary
  "#0369a1", // sky-700
  "#b45309", // amber-700
  "#047857", // emerald-700
  "#6d28d9", // violet-700
  "#be123c", // rose-700
  "#334155", // slate-700
  "#0f766e", // teal-700
];

export function DonutChart({
  data,
  totalLabel,
}: {
  data: DonutSlice[];
  totalLabel: string;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-[160px_1fr] sm:items-center">
      <div className="relative h-40 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="label"
              innerRadius="60%"
              outerRadius="100%"
              paddingAngle={2}
              stroke="none"
            >
              {data.map((d, i) => (
                <Cell key={d.id} fill={PALETTE[i % PALETTE.length]} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload || payload.length === 0) return null;
                const p = payload[0];
                if (!p) return null;
                const val = typeof p.value === "number" ? p.value : 0;
                const pct = total > 0 ? Math.round((val / total) * 100) : 0;
                return (
                  <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs shadow-md">
                    <p className="font-medium text-zinc-800">{p.name}</p>
                    <p className="mt-1 font-mono text-zinc-700">
                      {formatRWF(val)} RWF · {pct}%
                    </p>
                  </div>
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <p className="text-[10px] uppercase tracking-wide text-zinc-500">
            {totalLabel}
          </p>
          <p className="font-mono text-sm font-semibold tabular-nums text-zinc-800">
            {formatRWF(total)}
          </p>
        </div>
      </div>

      <ul className="space-y-1.5 text-sm">
        {data.map((d, i) => {
          const pct = total > 0 ? Math.round((d.value / total) * 100) : 0;
          return (
            <li key={d.id} className="flex items-center gap-2">
              <span
                aria-hidden
                className="h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ background: PALETTE[i % PALETTE.length] }}
              />
              <span className="truncate text-zinc-700">{d.label}</span>
              <span className="ml-auto whitespace-nowrap font-mono text-xs text-zinc-600">
                {formatRWF(d.value)} · {pct}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
