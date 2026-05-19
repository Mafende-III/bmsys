import Link from "next/link";
import { requireSeller } from "@/lib/auth-guards";
import { listAllowedChannels } from "@/lib/permissions";
import { getActiveChannelId } from "@/lib/sales/actions";
import {
  categoryIcon,
  categorySlug,
  listSellableCategories,
} from "@/lib/sales/queries";

export default async function SellHome() {
  const user = await requireSeller();
  const allowedChannels = await listAllowedChannels(user.id);
  if (allowedChannels.length === 0) {
    // layout already shows a guidance card
    return null;
  }
  const cookieChannelId = await getActiveChannelId();
  const allowedIds = new Set(allowedChannels.map((c) => c.id));
  const activeChannelId =
    cookieChannelId && allowedIds.has(cookieChannelId)
      ? cookieChannelId
      : (allowedChannels[0]?.id ?? "");
  if (!activeChannelId) return null;

  const categories = await listSellableCategories(activeChannelId);

  if (categories.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 p-6 text-center text-sm text-zinc-600">
        <p className="text-base font-medium text-zinc-800">No products yet</p>
        <p className="mt-1">
          Ask the owner to add products in /products.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {categories.map((c) => (
        <Link
          key={c.name}
          href={`/sell/category/${categorySlug(c.name)}`}
          className="flex flex-col items-center gap-2 rounded-2xl border border-zinc-200 bg-white p-4 text-center shadow-sm hover:border-zinc-300 hover:shadow"
        >
          <span className="text-4xl" aria-hidden>
            {categoryIcon(c.name)}
          </span>
          <span className="text-sm font-medium">{c.name}</span>
          <span className="text-xs text-zinc-500">
            {c.productCount} {c.productCount === 1 ? "product" : "products"}
          </span>
        </Link>
      ))}
    </div>
  );
}
