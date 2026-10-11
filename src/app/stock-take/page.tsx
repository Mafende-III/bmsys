import { getTranslations, getLocale } from "next-intl/server";
import { requireOwner } from "@/lib/auth-guards";
import {
  listStockTakeRows,
  listStockTakeHistory,
} from "@/lib/stock-takes/queries";
import { Card } from "@/components/ui";
import { StockTakeForm } from "./_components/StockTakeForm";
import { StockTakeHistory } from "./_components/StockTakeHistory";

export const dynamic = "force-dynamic";

export default async function StockTakePage() {
  await requireOwner();
  const [rows, history] = await Promise.all([
    listStockTakeRows(),
    listStockTakeHistory(10),
  ]);
  const t = await getTranslations("stockTake");
  const locale = await getLocale();

  return (
    <main className="mx-auto max-w-2xl space-y-3 p-4">
      <header>
        <h1 className="text-xl font-bold text-ink">{t("title")}</h1>
        <p className="text-[13px] text-ink-2">{t("subtitle")}</p>
      </header>

      {rows.length === 0 ? (
        <Card className="p-6 text-center text-sm text-ink-2">
          {t("empty")}
        </Card>
      ) : (
        <StockTakeForm rows={rows} />
      )}

      <StockTakeHistory entries={history} locale={locale} />
    </main>
  );
}
