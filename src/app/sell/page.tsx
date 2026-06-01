import Link from "next/link";
import { Package } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireSeller } from "@/lib/auth-guards";
import { iconForKey } from "@/lib/icons";
import { listAllowedChannels } from "@/lib/permissions";
import { getActiveChannelId } from "@/lib/sales/actions";
import { listSellableCategories } from "@/lib/sales/queries";

export default async function SellHome() {
  const user = await requireSeller();
  const allowedChannels = await listAllowedChannels(user.id);
  if (allowedChannels.length === 0) return null;
  const t = await getTranslations("sell");
  const tp = await getTranslations("products");

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
        <Package className="mx-auto h-10 w-10 text-zinc-400" strokeWidth={1.5} />
        <p className="mt-3 text-base font-medium text-zinc-800">
          {tp("title")}
        </p>
        <p className="mt-1 text-sm text-zinc-600">{tp("emptyFiltered")}</p>
        {user.role === "OWNER" && (
          <Link
            href="/products/new"
            className="mt-4 inline-block rounded-2xl bg-zinc-900 px-5 py-3 text-sm font-medium text-white hover:bg-zinc-800"
          >
            {tp("new")}
          </Link>
        )}
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-4 text-lg font-medium text-zinc-700">
        {t("pickCategory")}
      </h2>
      <div
        data-tour="sell-category-grid"
        className="grid grid-cols-2 gap-3 sm:grid-cols-3"
      >
        {categories.map((c) => {
          const Icon = c.iconKey ? iconForKey(c.iconKey) : null;
          return (
            <Link
              key={c.slug}
              href={`/sell/category/${c.slug}`}
              className="flex aspect-square flex-col items-center justify-center gap-2 rounded-3xl border-2 border-zinc-200 bg-white p-4 text-center shadow-sm transition hover:border-zinc-300 hover:shadow-md active:scale-95"
            >
              {c.iconImagePath ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/uploads/${c.iconImagePath}`}
                  alt=""
                  className="h-14 w-14 object-contain"
                />
              ) : Icon ? (
                <Icon
                  className="h-12 w-12 text-zinc-800"
                  strokeWidth={1.5}
                />
              ) : (
                <span className="text-5xl" aria-hidden>
                  {c.iconEmoji}
                </span>
              )}
              <span className="text-sm font-medium leading-tight">
                {c.name}
              </span>
              <span className="text-[10px] uppercase tracking-wide text-zinc-500">
                {t("cartItems", { count: c.productCount })}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
