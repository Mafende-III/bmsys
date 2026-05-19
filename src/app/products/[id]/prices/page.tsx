import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/auth-guards";
import { getProductChannelPrices } from "@/lib/channel-prices/queries";
import { PricingMatrix } from "./_components/PricingMatrix";

export default async function ProductPricesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireOwner();

  const { id } = await params;
  const data = await getProductChannelPrices(id);
  if (!data) notFound();

  const { product, rows } = data;

  return (
    <main className="mx-auto max-w-3xl p-4 sm:p-6">
      <header className="mb-4">
        <Link
          href={`/products/${id}`}
          className="text-sm text-zinc-600 hover:underline"
        >
          ← Back to product
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">Channel pricing</h1>
        <p className="text-sm text-zinc-600">
          <span className="font-medium">{product.name}</span>{" "}
          <span className="font-mono text-xs text-zinc-500">
            ({product.sku})
          </span>
        </p>
        {!product.active && (
          <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            This product is archived. Prices can be viewed but not edited.
          </p>
        )}
      </header>

      <PricingMatrix product={product} rows={rows} />
    </main>
  );
}
