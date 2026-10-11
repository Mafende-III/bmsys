import { getTranslations } from "next-intl/server";
import { requireOwner } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import { getRestockPlan } from "@/lib/restock/queries";
import { COVER_TARGET_DAYS, BURN_WINDOW_DAYS } from "@/lib/restock/plan";
import { Card } from "@/components/ui";
import { RestockTable } from "./_components/RestockTable";

export const dynamic = "force-dynamic";

export default async function RestockPage() {
  await requireOwner();
  const [plan, suppliers] = await Promise.all([
    getRestockPlan(),
    prisma.supplier.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  const t = await getTranslations("restock");

  return (
    <main className="mx-auto max-w-5xl space-y-3 p-4">
      <header>
        <h1 className="text-xl font-bold text-ink">{t("title")}</h1>
        <p className="text-[13px] text-ink-2">
          {t("subtitle", {
            burnDays: BURN_WINDOW_DAYS,
            coverDays: COVER_TARGET_DAYS,
          })}
        </p>
      </header>

      {plan.rows.length === 0 ? (
        <Card className="p-6 text-center text-sm text-ink-2">
          {t("empty")}
        </Card>
      ) : (
        <RestockTable rows={plan.rows} suppliers={suppliers} />
      )}

      <p className="text-center text-xs text-ink-2">{t("scopeNote")}</p>
    </main>
  );
}
