import Link from "next/link";
import { Check, Pause, Search } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireOwner } from "@/lib/auth-guards";
import { listChannelsWithUsage } from "@/lib/channels/queries";
import { Card, StatusPill } from "@/components/ui";
import { cn } from "@/lib/cn";

type SearchParams = {
  search?: string;
  active?: string;
};

export default async function ChannelsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireOwner();

  const params = await searchParams;
  const search = params.search?.trim() || undefined;
  const activeFilter: boolean | "all" =
    params.active === "all"
      ? "all"
      : params.active === "false"
        ? false
        : true;

  const channels = await listChannelsWithUsage({ search, active: activeFilter });
  const t = await getTranslations("channels");
  const tc = await getTranslations("common");

  return (
    <main className="mx-auto max-w-2xl space-y-3 p-4">
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-ink">{t("title")}</h1>
          <p className="text-[13px] text-ink-2">{t("subtitle")}</p>
        </div>
        <Link
          href="/channels/new"
          className="flex h-11 shrink-0 items-center rounded-full bg-fab px-4 text-sm font-bold text-white shadow-fab active:translate-y-[2px]"
        >
          {t("new")}
        </Link>
      </header>

      <form method="get" className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute left-4 top-3 h-[18px] w-[18px] text-ink-2"
            strokeWidth={2.2}
          />
          <input
            type="search"
            name="search"
            defaultValue={search ?? ""}
            placeholder={t("searchPlaceholder")}
            className="block h-11 w-full rounded-[14px] border border-rule bg-surface pl-11 pr-4 text-[15px] text-ink focus:border-rule-active focus:outline-none focus:ring-1 focus:ring-rule-active"
          />
        </div>
        <select
          name="active"
          defaultValue={params.active ?? "true"}
          aria-label={tc("status")}
          className="h-11 w-28 rounded-panel border border-rule bg-surface px-2.5 text-[13px] text-ink-2"
        >
          <option value="true">{tc("active")}</option>
          <option value="false">{t("inactive")}</option>
          <option value="all">{tc("all")}</option>
        </select>
        <button
          type="submit"
          className="h-11 shrink-0 rounded-full bg-surface px-4 text-[13px] font-bold text-primary ring-1 ring-inset ring-rule"
        >
          {tc("filter")}
        </button>
      </form>

      {channels.length === 0 ? (
        <Card className="p-6 text-center text-sm text-ink-2">
          {t("empty")}
        </Card>
      ) : (
        <Card className="px-3.5 py-1">
          {channels.map((c, i) => (
            <Link
              key={c.id}
              href={`/channels/${c.id}`}
              className={cn(
                "flex items-center gap-3 py-3",
                i > 0 && "border-t border-rule-hair",
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-bold text-ink">
                  {c.name}
                </p>
                <p className="num mt-0.5 truncate text-xs text-ink-2">
                  {c.slug} · {t("headerCustomers")} {c.customerCount} ·{" "}
                  {t("headerSales30")} {c.recentSales}
                </p>
              </div>
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
