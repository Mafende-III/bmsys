import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireOwner } from "@/lib/auth-guards";
import { listCoupons } from "@/lib/coupons/queries";
import { CouponList } from "./_components/CouponList";

export const dynamic = "force-dynamic";

export default async function CouponsPage() {
  await requireOwner();
  const coupons = await listCoupons(100);
  const t = await getTranslations("coupons");

  return (
    <main className="mx-auto max-w-2xl space-y-3 p-4">
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-ink">{t("title")}</h1>
          <p className="text-[13px] text-ink-2">{t("subtitle")}</p>
        </div>
        <Link
          href="/coupons/new"
          className="flex h-11 shrink-0 items-center rounded-full bg-fab px-4 text-sm font-bold text-white shadow-fab active:translate-y-[2px]"
        >
          {t("new")}
        </Link>
      </header>

      <CouponList coupons={coupons} />
    </main>
  );
}
