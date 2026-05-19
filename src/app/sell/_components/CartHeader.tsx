"use client";

import Link from "next/link";
import { formatRWF } from "@/lib/format";
import { useCart } from "./CartProvider";

export function CartHeader({ channelName }: { channelName: string }) {
  const { cart, total, ready } = useCart();
  const itemCount = cart?.items.reduce((s, i) => s + i.qty, 0) ?? 0;
  const hasItems = ready && itemCount > 0;

  return (
    <div className="sticky top-0 z-10 -mx-4 mb-4 border-b border-zinc-200 bg-white/95 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wide text-zinc-500">
            Channel
          </p>
          <p className="truncate text-sm font-medium">{channelName}</p>
        </div>
        {hasItems ? (
          <Link
            href="/sell/checkout"
            className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          >
            🛒 {itemCount} · {formatRWF(total)}
          </Link>
        ) : (
          <span className="rounded-lg bg-zinc-100 px-3 py-2 text-xs text-zinc-500">
            Cart empty
          </span>
        )}
      </div>
    </div>
  );
}
