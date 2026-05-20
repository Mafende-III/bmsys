"use client";

import Link from "next/link";
import { formatRWF } from "@/lib/format";
import { useCart } from "./CartProvider";

export function CartHeader({ channelName }: { channelName: string }) {
  const { cart, total, ready } = useCart();
  const itemCount = cart?.items.reduce((s, i) => s + i.qty, 0) ?? 0;
  const hasItems = ready && itemCount > 0;

  if (!hasItems) return null;

  return (
    <Link
      href="/sell/checkout"
      className="fixed bottom-0 left-0 right-0 z-20 mx-auto block max-w-2xl bg-zinc-900 px-4 py-3 text-white shadow-2xl sm:px-6"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-2xl" aria-hidden>
            🛒
          </span>
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-zinc-300">
              Selling on {channelName}
            </p>
            <p className="truncate text-sm font-medium">
              {itemCount} {itemCount === 1 ? "item" : "items"}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-mono text-lg font-semibold tabular-nums">
            {formatRWF(total)}
          </p>
          <p className="text-[10px] uppercase tracking-wide text-zinc-300">
            Tap to pay →
          </p>
        </div>
      </div>
    </Link>
  );
}
