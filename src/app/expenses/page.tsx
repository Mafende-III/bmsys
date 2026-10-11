import Link from "next/link";
import { Banknote, ChevronRight, Landmark, Repeat, Smartphone } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireOwner } from "@/lib/auth-guards";
import { formatRWF } from "@/lib/format";
import {
  listExpenseCategories,
  listExpenses,
} from "@/lib/expenses/queries";
import { Card, StatusPill, type StatusTone } from "@/components/ui";
import { cn } from "@/lib/cn";

const METHOD_TONE: Record<string, StatusTone> = {
  CASH: "warning",
  MOMO: "info",
  BANK: "neutral",
};

function MethodIcon({ method }: { method: string }) {
  if (method === "CASH") return <Banknote className="h-3 w-3" strokeWidth={2.4} />;
  if (method === "MOMO") return <Smartphone className="h-3 w-3" strokeWidth={2.4} />;
  return <Landmark className="h-3 w-3" strokeWidth={2.4} />;
}

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ categoryId?: string; paymentMethod?: string }>;
}) {
  await requireOwner();

  const sp = await searchParams;
  const categoryId = sp.categoryId || undefined;
  const paymentMethod =
    sp.paymentMethod === "CASH" ||
    sp.paymentMethod === "MOMO" ||
    sp.paymentMethod === "BANK"
      ? sp.paymentMethod
      : ("all" as const);

  const [categories, expenses] = await Promise.all([
    listExpenseCategories(),
    listExpenses({ categoryId, paymentMethod }),
  ]);

  const totalShown = expenses.reduce((s, e) => s + e.amount, 0);
  const t = await getTranslations("expenses");
  const tc = await getTranslations("common");
  const tt = await getTranslations("treasury");

  const methodLabel: Record<string, string> = {
    CASH: tt("cash"),
    MOMO: tt("momo"),
    BANK: tt("bank"),
  };

  return (
    <main className="mx-auto max-w-2xl space-y-3 p-4">
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-ink">{t("title")}</h1>
          <p className="num text-[13px] text-ink-2">
            {t("count", {
              count: expenses.length,
              total: formatRWF(totalShown),
            })}
          </p>
        </div>
        <Link
          href="/expenses/new"
          className="flex h-11 shrink-0 items-center rounded-full bg-fab px-4 text-sm font-bold text-white shadow-fab active:translate-y-[2px]"
        >
          {t("new")}
        </Link>
      </header>

      <form method="get" className="flex gap-2">
        <select
          name="categoryId"
          defaultValue={categoryId ?? ""}
          aria-label={t("headerCategory")}
          className="h-10 min-w-0 flex-1 rounded-panel border border-rule bg-surface px-2.5 text-[13px] text-ink-2"
        >
          <option value="">{tc("all")}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          name="paymentMethod"
          defaultValue={paymentMethod === "all" ? "" : paymentMethod}
          aria-label={t("form.method")}
          className="h-10 w-28 rounded-panel border border-rule bg-surface px-2.5 text-[13px] text-ink-2"
        >
          <option value="">{tc("all")}</option>
          <option value="CASH">{tt("cash")}</option>
          <option value="MOMO">{tt("momo")}</option>
          <option value="BANK">{tt("bank")}</option>
        </select>
        <button
          type="submit"
          className="h-10 shrink-0 rounded-full bg-surface px-4 text-[13px] font-bold text-primary ring-1 ring-inset ring-rule"
        >
          {tc("filter")}
        </button>
      </form>

      <Link href="/expenses/recurring" className="block">
        <Card className="flex items-center gap-3 p-3.5 transition-shadow hover:ring-rule">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sheet bg-surface-sunk text-primary">
            <Repeat className="h-5 w-5" strokeWidth={2.2} />
          </span>
          <span className="min-w-0 flex-1 text-[15px] font-bold text-ink">
            {t("recurring.title")}
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-ink-2" strokeWidth={2.4} />
        </Card>
      </Link>

      {expenses.length === 0 ? (
        <Card className="p-6 text-center text-sm text-ink-2">
          {t("empty")}
        </Card>
      ) : (
        <Card className="px-3.5 py-1">
          {expenses.map((e, i) => (
            <div
              key={e.id}
              className={cn(
                "flex items-center gap-3 py-3",
                i > 0 && "border-t border-rule-hair",
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-bold text-ink">
                  {e.description}
                </p>
                <p className="num mt-0.5 truncate text-xs text-ink-2">
                  {new Date(e.date).toLocaleDateString()} · {e.category.name}
                  {e.supplier ? ` · ${e.supplier.name}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="num text-[15px] font-bold text-ink">
                  {formatRWF(e.amount)}
                </span>
                <StatusPill
                  tone={METHOD_TONE[e.paymentMethod] ?? "neutral"}
                  icon={<MethodIcon method={e.paymentMethod} />}
                >
                  {methodLabel[e.paymentMethod] ?? e.paymentMethod}
                </StatusPill>
              </div>
            </div>
          ))}
        </Card>
      )}
    </main>
  );
}
