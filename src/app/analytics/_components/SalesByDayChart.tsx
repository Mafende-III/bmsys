"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatRWF } from "@/lib/format";

export type DailyPoint = {
  iso: string;
  label: string;
  total: number;
  /// Gross profit for the day (revenue − cost of goods sold).
  profit: number;
  count: number;
};

/**
 * Soft area chart for the sales-by-day trend. Dark area = revenue,
 * green area = gross profit for the same day, so the gap between the
 * two curves is the cost of goods. Tooltip shows date, revenue,
 * profit, and sale count. When the period has zero sales the parent
 * renders an empty state instead of this chart.
 */
export function SalesByDayChart({ data }: { data: DailyPoint[] }) {
  return (
    <div className="w-full">
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 10, right: 8, left: -10, bottom: 0 }}
        >
          <defs>
            <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#18181b" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#18181b" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="profitFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#15803d" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#15803d" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "#71717a" }}
            tickLine={false}
            axisLine={{ stroke: "#e4e4e7" }}
            interval="preserveStartEnd"
            minTickGap={20}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#71717a" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) =>
              v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)
            }
            width={48}
          />
          <Tooltip
            cursor={{ stroke: "#a1a1aa", strokeDasharray: "3 3" }}
            content={({ active, payload }) => {
              if (!active || !payload || payload.length === 0) return null;
              const p = payload[0]?.payload as DailyPoint | undefined;
              if (!p) return null;
              return (
                <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs shadow-md">
                  <p className="font-medium text-zinc-800">{p.label}</p>
                  <p className="mt-1 font-mono text-zinc-700">
                    {formatRWF(p.total)} RWF
                  </p>
                  <p className="font-mono text-green-700">
                    +{formatRWF(p.profit)} profit
                  </p>
                  <p className="text-[10px] text-zinc-500">
                    {p.count} {p.count === 1 ? "sale" : "sales"}
                  </p>
                </div>
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="total"
            stroke="#18181b"
            strokeWidth={2}
            fill="url(#salesFill)"
          />
          <Area
            type="monotone"
            dataKey="profit"
            stroke="#15803d"
            strokeWidth={2}
            fill="url(#profitFill)"
          />
        </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-1 flex items-center justify-center gap-4 text-[11px] text-zinc-600">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-4 rounded-sm bg-zinc-900/70" />
          Revenue
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-4 rounded-sm bg-green-700/70" />
          Profit
        </span>
      </div>
    </div>
  );
}
