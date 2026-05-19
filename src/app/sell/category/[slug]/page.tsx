import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSeller } from "@/lib/auth-guards";
import { formatRWF } from "@/lib/format";
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

  const { slug } = await params;
  const category = await findCategoryBySlug(slug);
  if (!category) notFound();

  const products = await listProductsForChannel(activeChannelId, {
    categoryId: category.id,
  });

  return (
    <div>
      <div className="mb-3">
        <Link href="/sell" className="text-sm text-zinc-600 hover:underline">
          ← Categories
        </Link>
        <h2 className="mt-1 flex items-center gap-2 text-xl font-semibold">
          <span>{category.iconEmoji}</span>
          <span>{category.name}</span>
        </h2>
        <p className="text-xs text-zinc-500">
          {products.length} {products.length === 1 ? "product" : "products"}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {products.map((p) => {
          const out =
            p.sealedCartons * p.unitsPerCarton + p.openedUnits === 0;
          return (
            <Link
              key={p.id}
              href={`/sell/product/${p.id}`}
              className={`flex flex-col gap-1 rounded-2xl border bg-white p-3 text-left shadow-sm transition ${
                out
                  ? "border-zinc-200 opacity-50"
                  : "border-zinc-200 hover:border-zinc-300 hover:shadow"
              }`}
            >
              <div className="flex items-start gap-2">
                <span className="text-2xl leading-none">{p.iconEmoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-medium">{p.name}</p>
                  <p className="font-mono text-[10px] text-zinc-500">
                    {p.sku}
                  </p>
                </div>
              </div>
              <p className="mt-1 text-sm tabular-nums">
                {formatRWF(p.unitPrice)}{" "}
                <span className="text-xs font-normal text-zinc-500">/ u</span>
              </p>
              <p className="text-xs text-zinc-500">
                {p.openedUnits} open · {p.sealedCartons} sealed
              </p>
            </Link>
          );
        })}
        {products.length === 0 && (
          <p className="col-span-full rounded-2xl border border-zinc-200 bg-white p-6 text-center text-sm text-zinc-500">
            No products in this category.
          </p>
        )}
      </div>
    </div>
  );
}
