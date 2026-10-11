import { getTranslations } from "next-intl/server";
import { requireOwner } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import { CouponForm } from "../_components/CouponForm";

export const dynamic = "force-dynamic";

export default async function NewCouponPage() {
  await requireOwner();
  const products = await prisma.product.findMany({
    where: { active: true },
    select: {
      id: true,
      name: true,
      sku: true,
      costPerCarton: true,
      unitsPerCarton: true,
      unitPrice: true,
      cartonPrice: true,
      minMarginBps: true,
    },
    orderBy: [{ name: "asc" }],
  });
  const t = await getTranslations("coupons.form");

  return (
    <main className="mx-auto max-w-2xl space-y-3 p-4">
      <header>
        <h1 className="text-xl font-bold text-ink">{t("newTitle")}</h1>
        <p className="text-[13px] text-ink-2">{t("newSubtitle")}</p>
      </header>

      <CouponForm products={products} />
    </main>
  );
}
