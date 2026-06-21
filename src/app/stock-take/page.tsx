import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireOwner } from "@/lib/auth-guards";
import { listStockTakeRows } from "@/lib/stock-takes/queries";
import { StockTakeForm } from "./_components/StockTakeForm";

export const dynamic = "force-dynamic";

export default async function StockTakePage() {
  await requireOwner();
  const rows = await listStockTakeRows();
  const t = await getTranslations("stockTake");
  const tc = await getTranslations("common");

  return (
    <main className="mx-auto max-w-3xl p-4 sm:p-6">
      <header className="mb-4">
        <Link
          href="/dashboard"
          className="text-sm text-zinc-600 hover:underline"
        >
          ← {tc("dashboard")}
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-zinc-600">{t("subtitle")}</p>
      </header>

      {rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center text-sm text-zinc-600">
          {t("empty")}
        </p>
      ) : (
        <StockTakeForm rows={rows} />
      )}
    </main>
  );
}
