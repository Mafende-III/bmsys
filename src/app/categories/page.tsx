import Link from "next/link";
import { Check, Pause } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireOwner } from "@/lib/auth-guards";
import { listCategoriesWithCounts } from "@/lib/categories/queries";
import { Card, StatusPill } from "@/components/ui";
import { cn } from "@/lib/cn";

export default async function CategoriesPage() {
  await requireOwner();
  const categories = await listCategoriesWithCounts();
  const t = await getTranslations("categories");
  const tc = await getTranslations("common");

  return (
    <main className="mx-auto max-w-2xl space-y-3 p-4">
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-ink">{t("title")}</h1>
          <p className="text-[13px] text-ink-2">{t("subtitle")}</p>
        </div>
        <Link
          href="/categories/new"
          data-tour="categories-new"
          className="flex h-11 shrink-0 items-center rounded-full bg-fab px-4 text-sm font-bold text-white shadow-fab active:translate-y-[2px]"
        >
          {t("new")}
        </Link>
      </header>

      {categories.length === 0 ? (
        <Card className="p-6 text-center text-sm text-ink-2">
          {t("empty")}
        </Card>
      ) : (
        <Card className="px-3.5 py-1">
          {categories.map((c, i) => (
            <Link
              key={c.id}
              href={`/categories/${c.id}`}
              className={cn(
                "flex items-center gap-3 py-3",
                i > 0 && "border-t border-rule-hair",
              )}
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-sheet bg-surface-sunk text-xl">
                {c.iconEmoji}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-bold text-ink">
                  {c.name}
                </span>
                <span className="num block truncate text-xs text-ink-2">
                  {c.slug} · {t("productCount", { count: c.productCount })} ·{" "}
                  {t("headerSort")} {c.sortOrder}
                </span>
              </span>
              {c.active ? (
                <StatusPill
                  tone="success"
                  icon={<Check className="h-3 w-3" strokeWidth={3} />}
                  className="shrink-0"
                >
                  {tc("active")}
                </StatusPill>
              ) : (
                <StatusPill
                  tone="neutral"
                  icon={<Pause className="h-3 w-3" strokeWidth={2.6} />}
                  className="shrink-0"
                >
                  {t("inactive")}
                </StatusPill>
              )}
            </Link>
          ))}
        </Card>
      )}
    </main>
  );
}
