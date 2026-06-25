import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSeller } from "@/lib/auth-guards";
import { iconForKey } from "@/lib/icons";
import { listAllowedChannels } from "@/lib/permissions";
import { getActiveChannelId } from "@/lib/sales/actions";
import { listProductsForChannel } from "@/lib/sales/queries";
import { resolveMarginBps } from "@/lib/sales/floor";
import { getSettings } from "@/lib/settings/queries";
import { AddToCartForm } from "../../_components/AddToCartForm";

export default async function SellProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
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

  const { id } = await params;
  const [products, settings] = await Promise.all([
    listProductsForChannel(activeChannelId),
    getSettings(),
  ]);
  const product = products.find((p) => p.id === id);
  if (!product) notFound();
  const effectiveMarginBps = resolveMarginBps(
    product.minMarginBps,
    settings.defaultMinMarginBps,
  );

  return (
    <div className="space-y-5">
      <div>
        <Link
          href={`/sell/category/${product.categorySlug ?? "uncategorised"}`}
          className="text-sm text-zinc-600 hover:underline"
        >
          ← Back
        </Link>
        <div className="mt-2 flex items-center gap-3">
          {product.iconImagePath ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/uploads/${product.iconImagePath}`}
              alt=""
              className="h-14 w-14 shrink-0 object-contain"
            />
          ) : product.iconKey ? (
            (() => {
              const Icon = iconForKey(product.iconKey);
              return (
                <Icon
                  className="h-12 w-12 text-zinc-800"
                  strokeWidth={1.5}
                />
              );
            })()
          ) : (
            <span className="text-5xl" aria-hidden>
              {product.iconEmoji}
            </span>
          )}
          <h2 className="text-2xl font-semibold leading-tight">
            {product.name}
          </h2>
        </div>
      </div>

      <AddToCartForm
        product={product}
        effectiveMarginBps={effectiveMarginBps}
      />
    </div>
  );
}
