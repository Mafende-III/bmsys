import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSeller } from "@/lib/auth-guards";
import { formatRWF } from "@/lib/format";
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
    <div className="space-y-4">
      <div>
        <Link
          href={`/sell/category/${product.categorySlug ?? "uncategorised"}`}
          className="text-sm text-zinc-600 hover:underline"
        >
          ← Products
        </Link>
        <h2 className="mt-1 flex items-center gap-2 text-xl font-semibold">
          <span>{product.iconEmoji}</span>
          <span>{product.name}</span>
        </h2>
        <p className="font-mono text-xs text-zinc-500">{product.sku}</p>
        <p className="mt-1 text-xs text-zinc-600">
          {product.openedUnits} loose unit(s) open · {product.sealedCartons} sealed carton(s) ·{" "}
          {product.unitsPerCarton} per carton
        </p>
      </div>

      <AddToCartForm product={product} />
    </div>
  );
}
