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
          {category.iconImagePath ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/uploads/${category.iconImagePath}`}
              alt=""
              className="h-10 w-10 shrink-0 object-contain"
            />
          ) : category.iconKey ? (
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
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
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
              className={`flex flex-col overflow-hidden rounded-2xl border-2 bg-white transition active:scale-95 ${
                out
                  ? "border-zinc-200 opacity-60"
                  : "border-zinc-200 hover:border-zinc-400 hover:shadow-sm"
              }`}
            >
              <div className="flex aspect-[4/3] items-center justify-center bg-zinc-50 p-3">
                {p.iconImagePath ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/uploads/${p.iconImagePath}`}
                    alt=""
                    className="max-h-full max-w-full object-contain"
                  />
                ) : Icon ? (
                  <Icon
                    className="h-16 w-16 text-zinc-700"
                    strokeWidth={1.5}
                  />
                ) : (
                  <span className="text-6xl" aria-hidden>
                    {p.iconEmoji}
                  </span>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-1 p-3">
                <p className="line-clamp-2 text-sm font-medium leading-tight">
                  {p.name}
                </p>
                <p className="tabular-nums text-base font-semibold text-zinc-900">
                  {formatRWF(p.unitPrice)}{" "}
                  <span className="text-xs font-normal text-zinc-500">
                    / single
                  </span>
                </p>
                {out ? (
                  <p className="mt-auto text-xs font-medium text-red-700">
                    Out of stock
                  </p>
                ) : (
                  <p className="mt-auto text-xs text-zinc-500">
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
