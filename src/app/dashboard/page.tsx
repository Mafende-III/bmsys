import Link from "next/link";
import {
  AlertTriangle,
  Banknote,
  ClipboardList,
  LogOut,
  Package,
  PackagePlus,
  ReceiptText,
  Ticket,
  Wallet,
} from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { signOut } from "@/lib/auth";
import { requireOwner } from "@/lib/auth-guards";
import { getTodayProfitSummary } from "@/lib/analytics/queries";
import { getOpenSession } from "@/lib/cash-sessions/queries";
import { getRestockPlan } from "@/lib/restock/queries";
import { getWorkingCapital } from "@/lib/treasury/queries";
import { formatRWF } from "@/lib/format";
import { CaptionLabel, Card, KeycapTile } from "@/components/ui";
import type { Locale } from "@/i18n/config";
import { LanguageToggle } from "../_components/LanguageToggle";
import { WorkingCapitalCard } from "./_components/WorkingCapitalCard";

/**
 * The Money tab's home. Sell lives in the shell's floating button,
 * Stock/Reports/More live in the tab bar — this screen is today's
 * trade, the money position, what needs attention, and the shop
 * actions. Catalog/system links stay as a demoted chip row until
 * the More tab gets its own screen.
 */
export default async function DashboardPage() {
  const session = await requireOwner();
  const [openTill, today, capital, restock] = await Promise.all([
    getOpenSession(),
    getTodayProfitSummary(),
    getWorkingCapital(),
    getRestockPlan(),
  ]);
  const t = await getTranslations("dashboard");
  const tc = await getTranslations("common");
  const ts = await getTranslations("shell");
  const locale = (await getLocale()) as Locale;

  const alert = restock.urgentCount > 0 ? restock.orderRows[0] : undefined;

  return (
    <main className="mx-auto max-w-2xl space-y-3 p-4">
      {/* Greeting + the controls the shell doesn't carry yet */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold text-ink">
            {t("hello", { name: session.name?.split(" ")[0] ?? "owner" })}
          </h1>
          <p className="text-[13px] text-ink-2">
            {openTill
              ? t("tillOpen", { count: openTill.cashSalesCount })
              : t("tillClosed")}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <LanguageToggle current={locale} />
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button
              type="submit"
              aria-label={tc("signOut")}
              className="flex h-10 w-10 items-center justify-center rounded-keycap bg-keycap text-ink-2 shadow-keycap active:bg-none active:bg-well active:shadow-well"
            >
              <LogOut className="h-[18px] w-[18px]" strokeWidth={2} />
            </button>
          </form>
        </div>
      </div>

      {/* Today */}
      <Link href="/sales" data-tour="dash-today" className="block">
        <Card className="p-4 transition-shadow hover:ring-rule">
          <div className="flex items-center justify-between">
            <CaptionLabel>{t("todaySales")}</CaptionLabel>
            <span className="num text-[11px] text-ink-2">
              {today.salesCount}
            </span>
          </div>
          <div className="mt-2.5 grid grid-cols-2 gap-3">
            <div>
              <p className="text-[11px] text-ink-2">{t("todayRevenue")}</p>
              <p className="num mt-0.5 text-lg font-bold text-ink">
                {formatRWF(today.revenue)}
              </p>
            </div>
            <div className="border-l border-rule-hair pl-3.5">
              <p className="text-[11px] text-success">{t("todayProfit")}</p>
              <p
                className={`num mt-0.5 text-lg font-bold ${
                  today.profit >= 0 ? "text-success" : "text-error"
                }`}
              >
                {formatRWF(today.profit)}
              </p>
            </div>
          </div>
        </Card>
      </Link>

      {/* Money available + move cash */}
      <WorkingCapitalCard capital={capital} />

      {/* Needs attention */}
      {alert ? (
        <Link
          href="/restock"
          data-tour="dash-alert"
          className="flex items-center gap-2.5 rounded-sheet bg-warning-wash px-3.5 py-3"
        >
          <AlertTriangle
            className="h-[18px] w-[18px] shrink-0 text-warning"
            strokeWidth={2.2}
          />
          <span className="flex-1 text-[13px] font-semibold text-warning">
            {alert.urgency === "OUT" || alert.daysToOut == null
              ? t("alertOut", { name: alert.name })
              : t("alertDaysLeft", {
                  name: alert.name,
                  days: alert.daysToOut,
                })}
          </span>
          <span className="shrink-0 text-[13px] font-bold text-warning">
            {t("restock")} →
          </span>
        </Link>
      ) : null}

      {/* Shop actions */}
      <section data-tour="dash-actions" className="pt-1">
        <CaptionLabel className="mb-2.5 px-0.5">{t("runShop")}</CaptionLabel>
        <div className="grid grid-cols-3 gap-2.5">
          <KeycapTile href="/cash-sessions" label={ts("till")}>
            <Banknote className="h-6 w-6" strokeWidth={2} />
          </KeycapTile>
          <KeycapTile href="/purchases" label={t("receiveStock")}>
            <Package className="h-6 w-6" strokeWidth={2} />
          </KeycapTile>
          <KeycapTile href="/restock" label={t("restock")}>
            <PackagePlus className="h-6 w-6" strokeWidth={2} />
          </KeycapTile>
          <KeycapTile href="/stock-take" label={t("stockTake")}>
            <ClipboardList className="h-6 w-6" strokeWidth={2} />
          </KeycapTile>
          <KeycapTile href="/expenses" label={t("expenses")}>
            <Wallet className="h-6 w-6" strokeWidth={2} />
          </KeycapTile>
          <KeycapTile href="/coupons" label={t("coupons")}>
            <Ticket className="h-6 w-6" strokeWidth={2} />
          </KeycapTile>
          <KeycapTile href="/adjustments" label={t("losses")}>
            <AlertTriangle className="h-6 w-6" strokeWidth={2} />
          </KeycapTile>
          <KeycapTile href="/sales" label={t("salesHistory")}>
            <ReceiptText className="h-6 w-6" strokeWidth={2} />
          </KeycapTile>
        </div>
      </section>

      {/* Catalog & setup — demoted until the More tab exists */}
      <section data-tour="dash-setup" className="pb-2 pt-1">
        <CaptionLabel className="mb-2.5 px-0.5">{t("setup")}</CaptionLabel>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["/products", t("products")],
              ["/categories", t("categories")],
              ["/suppliers", t("suppliers")],
              ["/reports", t("dailySummary")],
              ["/users", t("users")],
              ["/channels", t("channels")],
              ["/audit", t("audit")],
              ["/settings", t("systemConfig")],
            ] as const
          ).map(([href, label]) => (
            <Link
              key={href}
              href={href}
              className="rounded-full bg-surface px-3.5 py-2 text-[13px] font-semibold text-ink-2 ring-1 ring-inset ring-rule"
            >
              {label}
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
