import Link from "next/link";
import { Search } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireOwner } from "@/lib/auth-guards";
import { listSuppliersWithCounts } from "@/lib/suppliers/queries";
import { Card } from "@/components/ui";
import { cn } from "@/lib/cn";

type SearchParams = { search?: string };

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireOwner();

  const params = await searchParams;
  const search = params.search?.trim() || undefined;

  const suppliers = await listSuppliersWithCounts({ search });
  const t = await getTranslations("suppliers");
  const tc = await getTranslations("common");

  return (
    <main className="mx-auto max-w-2xl space-y-3 p-4">
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-ink">{t("title")}</h1>
          <p className="text-[13px] text-ink-2">{t("subtitle")}</p>
        </div>
        <Link
          href="/suppliers/new"
          className="flex h-11 shrink-0 items-center rounded-full bg-fab px-4 text-sm font-bold text-white shadow-fab active:translate-y-[2px]"
        >
          {t("new")}
        </Link>
      </header>

      <form method="get" className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute left-4 top-3.5 h-[18px] w-[18px] text-ink-2"
            strokeWidth={2.2}
          />
          <input
            type="search"
            name="search"
            defaultValue={search ?? ""}
            placeholder={t("searchPlaceholder")}
            className="block h-12 w-full rounded-[14px] border border-rule bg-surface pl-11 pr-4 text-[15px] text-ink focus:border-rule-active focus:outline-none focus:ring-1 focus:ring-rule-active"
          />
        </div>
        <button
          type="submit"
          className="h-12 shrink-0 rounded-full bg-surface px-4 text-[13px] font-bold text-primary ring-1 ring-inset ring-rule"
        >
          {tc("search")}
        </button>
      </form>

      {suppliers.length === 0 ? (
        <Card className="p-6 text-center text-sm text-ink-2">
          {t("empty")}
        </Card>
      ) : (
        <Card className="px-3.5 py-1">
          {suppliers.map((s, i) => (
            <Link
              key={s.id}
              href={`/suppliers/${s.id}`}
              className={cn(
                "flex items-center gap-3 py-3",
                i > 0 && "border-t border-rule-hair",
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-bold text-ink">
                  {s.name}
                </p>
                <p className="num mt-0.5 truncate text-xs text-ink-2">
                  {s.phone ?? "—"}
                  {s.lastPurchaseAt
                    ? ` · ${t("lastPurchase", {
                        date: new Date(s.lastPurchaseAt).toLocaleDateString(),
                      })}`
                    : ""}
                </p>
              </div>
              <span className="num shrink-0 rounded-full bg-ground px-2.5 py-1 text-xs font-bold text-ink-2">
                {t("purchaseCount", { count: s.purchaseCount })}
              </span>
            </Link>
          ))}
        </Card>
      )}
    </main>
  );
}
