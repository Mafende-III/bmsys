"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setActiveChannel } from "@/lib/sales/actions";
import { useCart } from "./CartProvider";

type ChannelOption = { id: string; name: string };

export function ChannelPicker({
  channels,
  currentChannelId,
}: {
  channels: ChannelOption[];
  currentChannelId: string;
}) {
  const router = useRouter();
  const { cart, clear } = useCart();
  const [isPending, startTransition] = useTransition();

  if (channels.length <= 1) return null;

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const nextId = e.target.value;
    if (nextId === currentChannelId) return;

    const hasItems = (cart?.items.length ?? 0) > 0;
    if (
      hasItems &&
      !confirm("Switching channels clears the current cart. Continue?")
    ) {
      // revert the select visually
      e.target.value = currentChannelId;
      return;
    }
    if (hasItems) clear();

    startTransition(async () => {
      const r = await setActiveChannel(nextId);
      if (r.ok) router.refresh();
    });
  }

  return (
    <label className="block text-sm">
      <span className="text-[10px] uppercase tracking-wide text-zinc-500">
        Channel
      </span>
      <select
        value={currentChannelId}
        onChange={handleChange}
        disabled={isPending}
        className="mt-0.5 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm disabled:opacity-50"
      >
        {channels.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </label>
  );
}
