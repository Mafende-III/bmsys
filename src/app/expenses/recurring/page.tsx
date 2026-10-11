import Link from "next/link";
import { Check, Pause } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { requireOwner } from "@/lib/auth-guards";
import { formatRWF } from "@/lib/format";
import { listRecurring } from "@/lib/expenses/queries";
import { Card, StatusPill } from "@/components/ui";
import { cn } from "@/lib/cn";
import { RunRecurringButton } from "../_components/RunRecurringButton";

export default async function RecurringPage() {
  await requireOwner();

  const rows = await listRecurring();
  const t = await getTranslations("expenses.recurring");
  const tc = await getTranslations("common");
  const locale = await getLocale();

  // 2021-08-01 was a Sunday — index 0..6 maps to localized weekday names.
  const weekdayName = (i: number) =>
    new Intl.DateTimeFormat(locale, { weekday: "long" }).format(
      new Date(2021, 7, 1 + i),
    );

  const describeSchedule = (frequency: string, day: number) =>
    frequency === "WEEKLY"
      ? t("scheduleWeekly", { day: weekdayName(day) })
      : t("scheduleMonthly", { day });

  return (
    <main className="mx-auto max-w-2xl space-y-3 p-4">
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-ink">{t("title")}</h1>
          <p className="text-[13px] text-ink-2">
            {t("count", { count: rows.length })}
          </p>
        </div>
        <Link
          href="/expenses/recurring/new"
          className="flex h-11 shrink-0 items-center rounded-full bg-fab px-4 text-sm font-bold text-white shadow-fab active:translate-y-[2px]"
        >
          {t("new")}
        </Link>
      </header>

      <RunRecurringButton />

      {rows.length === 0 ? (
        <Card className="p-6 text-center text-sm text-ink-2">
          {t("empty")}
        </Card>
      ) : (
        <Card className="px-3.5 py-1">
          {rows.map((r, i) => (
            <Link
              key={r.id}
              href={`/expenses/recurring/${r.id}`}
              className={cn(
                "flex items-center gap-3 py-3",
                i > 0 && "border-t border-rule-hair",
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-bold text-ink">
                  {r.description}
                </p>
                <p className="mt-0.5 truncate text-xs text-ink-2">
                  {describeSchedule(r.frequency, r.dayOfPeriod)} ·{" "}
                  {r.category.name}
                </p>
                <p className="num mt-0.5 text-[11px] text-ink-2">
                  {t("createdCount", { count: r._count.expenses })} ·{" "}
                  {r.lastRunAt
                    ? t("lastRun", {
                        date: new Date(r.lastRunAt).toLocaleDateString(),
                      })
                    : t("neverRun")}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="num text-[15px] font-bold text-ink">
                  {formatRWF(r.amount)}
                </span>
                {r.active ? (
                  <StatusPill
                    tone="success"
                    icon={<Check className="h-3 w-3" strokeWidth={3} />}
                  >
                    {tc("active")}
                  </StatusPill>
                ) : (
                  <StatusPill
                    tone="neutral"
                    icon={<Pause className="h-3 w-3" strokeWidth={2.6} />}
                  >
                    {t("inactive")}
                  </StatusPill>
                )}
              </div>
            </Link>
          ))}
        </Card>
      )}
    </main>
  );
}
