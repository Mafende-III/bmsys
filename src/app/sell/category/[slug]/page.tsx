import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireSeller } from "@/lib/auth-guards";
import { formatRWF } from "@/lib/format";
import { iconForKey } from "@/lib/icons";
import { listAllowedChannels } from "@/lib/permissions";
import { getActiveChannelId } from "@/lib/sales/actions";
import {
  findCategoryBySlug,
  listProductsForChannel,
} from "@/lib/sales/queries";

export default async function SellCategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
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

  const t = await getTranslations("sell");
  const { slug } = await params;
  const category = await findCategoryBySlug(slug);
  if (!category) notFound();

  const all = await listProductsForChannel(activeChannelId, {
    categoryId: category.id,
  });

  return (
    <div>
      <div className="mb-4">
        <Link
          href="/sell"
          className="inline-flex items-center gap-1 text-sm text-zinc-600 hover:underline"
        >
          ← {t("backToCategories")}
        </Link>
        <h2 className="mt-2 flex items-center gap-3 text-2xl font-semibold">
          {category.iconKey ? (
            (() => {
              const Icon = iconForKey(category.iconKey);
              return (
                <Icon className="h-9 w-9 text-zinc-800" strokeWidth={1.5} />
              );
            })()
          ) : (
            <span className="text-4xl" aria-hidden>
              {category.iconEmoji}
            </span>
          )}
          <span>{category.name}</span>
        </h2>
      </div>

      <div
        data-tour="sell-product-grid"
        className="grid grid-cols-1 gap-3 sm:grid-cols-2"
      >
        {all.map((p) => {
          const totalAvailable =
            p.openedUnits + p.sealedCartons * p.unitsPerCarton;
          const out = totalAvailable === 0;
          const Icon = p.iconKey ? iconForKey(p.iconKey) : null;
          return (
            <Link
              key={p.id}
              href={`/sell/product/${p.id}`}
              className={`flex items-center gap-3 rounded-2xl border-2 bg-white p-4 transition active:scale-95 ${
                out
                  ? "border-zinc-200 opacity-60"
                  : "border-zinc-200 hover:border-zinc-400 hover:shadow-sm"
              }`}
            >
              {Icon ? (
                <Icon
                  className="h-9 w-9 shrink-0 text-zinc-800"
                  strokeWidth={1.5}
                />
              ) : (
                <span className="text-4xl" aria-hidden>
                  {p.iconEmoji}
                </span>
              )}
              <div className="flex-1 min-w-0">
                <p className="line-clamp-2 text-base font-medium">{p.name}</p>
                <p className="mt-0.5 text-sm tabular-nums text-zinc-700">
                  {formatRWF(p.unitPrice)}
                  <span className="text-xs font-normal text-zinc-500"> / single</span>
                </p>
                {out ? (
                  <p className="mt-1 text-xs font-medium text-red-700">
                    Out of stock
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-zinc-500">
                    {p.openedUnits} open
                    {p.sealedCartons > 0 && (
                      <> · {p.sealedCartons} sealed</>
                    )}
                  </p>
                )}
              </div>
            </Link>
          );
        })}
        {all.length === 0 && (
          <p className="col-span-full rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center text-sm text-zinc-600">
            No items in this category.
          </p>
        )}
      </div>
    </div>
  );
}
