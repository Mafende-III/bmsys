"use client";

import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatRWF } from "@/lib/format";

export type TopSellerBar = {
  productId: string;
  name: string;
  sku: string;
  unitsSold: number;
  revenue: number;
};

/**
 * Horizontal bar chart for top sellers — easier to compare than
 * the previous numbered list, especially when the gap between
 * #1 and #2 is large. Bars are sized by units sold; revenue
 * shows in the tooltip so a high-priced low-volume seller is
 * still visible.
 */
export function TopSellersChart({ data }: { data: TopSellerBar[] }) {
  const height = Math.max(140, 40 + data.length * 36);

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 12, left: 0, bottom: 0 }}
        >
          <XAxis
            type="number"
            tick={{ fontSize: 11, fill: "#71717a" }}
            tickLine={false}
            axisLine={false}
            hide
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: 12, fill: "#3f3f46" }}
            tickLine={false}
            axisLine={false}
            width={130}
            interval={0}
          />
          <Tooltip
            cursor={{ fill: "#f4f4f5" }}
            content={({ active, payload }) => {
              if (!active || !payload || payload.length === 0) return null;
              const p = payload[0]?.payload as TopSellerBar | undefined;
              if (!p) return null;
              return (
                <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs shadow-md">
                  <p className="font-medium text-zinc-800">{p.name}</p>
                  <p className="font-mono text-[10px] text-zinc-500">{p.sku}</p>
                  <p className="mt-1 text-zinc-700">
                    <span className="font-semibold">{p.unitsSold}</span> units
                  </p>
                  <p className="font-mono text-zinc-700">
                    {formatRWF(p.revenue)} RWF
                  </p>
                </div>
              );
            }}
          />
          <Bar dataKey="unitsSold" radius={[4, 4, 4, 4]}>
            {data.map((_, i) => (
              <Cell key={i} fill={i === 0 ? "#18181b" : "#52525b"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
