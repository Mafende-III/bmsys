import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PackagePlus } from "lucide-react";
import { requireOwner } from "@/lib/auth-guards";
import { getRestockPlan } from "@/lib/restock/queries";
import { COVER_TARGET_DAYS, BURN_WINDOW_DAYS } from "@/lib/restock/plan";
import { RestockTable } from "./_components/RestockTable";

export const dynamic = "force-dynamic";

export default async function RestockPage() {
  await requireOwner();
  const plan = await getRestockPlan();
  const t = await getTranslations("restock");
  const tc = await getTranslations("common");

  return (
    <main className="mx-auto max-w-4xl space-y-5 p-4 sm:p-6">
      <header>
        <Link
          href="/dashboard"
          className="text-sm text-zinc-600 hover:underline"
        >
          ← {tc("dashboard")}
        </Link>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold">
          <PackagePlus className="h-6 w-6" strokeWidth={2} />
          {t("title")}
        </h1>
        <p className="text-sm text-zinc-600">
          {t("subtitle", {
            burnDays: BURN_WINDOW_DAYS,
            coverDays: COVER_TARGET_DAYS,
          })}
        </p>
      </header>

      {plan.rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center text-sm text-zinc-600">
          {t("empty")}
        </p>
      ) : (
        <RestockTable rows={plan.rows} />
      )}

      <p className="text-center text-xs text-zinc-500">{t("scopeNote")}</p>
    </main>
  );
}
