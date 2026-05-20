import Link from "next/link";
import { requireSeller } from "@/lib/auth-guards";
import { listAllowedChannels } from "@/lib/permissions";
import { getActiveChannelId } from "@/lib/sales/actions";
import { listSellableCategories } from "@/lib/sales/queries";

export default async function SellHome() {
  const user = await requireSeller();
  const allowedChannels = await listAllowedChannels(user.id);
  if (allowedChannels.length === 0) return null;

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
      <div className="rounded-3xl border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center">
        <p className="text-2xl" aria-hidden>📦</p>
        <p className="mt-3 text-base font-medium text-zinc-800">
          Nothing to sell yet
        </p>
        <p className="mt-1 text-sm text-zinc-600">
          {user.role === "OWNER"
            ? "Add products to put items on the shelf."
            : "Ask the owner to add products."}
        </p>
        {user.role === "OWNER" && (
          <Link
            href="/products/new"
            className="mt-4 inline-block rounded-2xl bg-zinc-900 px-5 py-3 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Add a product
          </Link>
        )}
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-4 text-lg font-medium text-zinc-700">
        Pick a category
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {categories.map((c) => (
          <Link
            key={c.slug}
            href={`/sell/category/${c.slug}`}
            className="flex aspect-square flex-col items-center justify-center gap-2 rounded-3xl border-2 border-zinc-200 bg-white p-4 text-center shadow-sm transition hover:border-zinc-300 hover:shadow-md active:scale-95"
          >
            <span className="text-5xl" aria-hidden>
              {c.iconEmoji}
            </span>
            <span className="text-sm font-medium leading-tight">{c.name}</span>
            <span className="text-[10px] uppercase tracking-wide text-zinc-500">
              {c.productCount} {c.productCount === 1 ? "item" : "items"}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
