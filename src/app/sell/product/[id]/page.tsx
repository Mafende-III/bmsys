import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSeller } from "@/lib/auth-guards";
import { listAllowedChannels } from "@/lib/permissions";
import { getActiveChannelId } from "@/lib/sales/actions";
import { listProductsForChannel } from "@/lib/sales/queries";
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
  const products = await listProductsForChannel(activeChannelId);
  const product = products.find((p) => p.id === id);
  if (!product) notFound();

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
          <span className="text-5xl" aria-hidden>{product.iconEmoji}</span>
          <h2 className="text-2xl font-semibold leading-tight">
            {product.name}
          </h2>
        </div>
      </div>

      <AddToCartForm product={product} />
    </div>
  );
}
