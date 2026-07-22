import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Banknote,
  ClipboardList,
  Ticket,
  type LucideIcon,
  Package,
  PackagePlus,
  ReceiptText,
  Settings as SettingsIcon,
  ShieldCheck,
  ShoppingBag,
  TrendingUp,
  Store,
  Tag,
  Truck,
  Users,
  Wallet,
} from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { signOut } from "@/lib/auth";
import { requireOwner } from "@/lib/auth-guards";
import { getTodayProfitSummary } from "@/lib/analytics/queries";
import { getOpenSession } from "@/lib/cash-sessions/queries";
import { getSettings } from "@/lib/settings/queries";
import { formatRWF } from "@/lib/format";
import type { Locale } from "@/i18n/config";
import { LanguageToggle } from "../_components/LanguageToggle";

export default async function DashboardPage() {
  const session = await requireOwner();
  const [openTill, { companyName, logoUrl }, today] = await Promise.all([
    getOpenSession(),
    getSettings(),
    getTodayProfitSummary(),
  ]);
  const t = await getTranslations("dashboard");
  const tc = await getTranslations("common");
  const locale = (await getLocale()) as Locale;

  return (
    <main className="mx-auto max-w-5xl p-4 sm:p-6">
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt=""
              className="h-12 w-12 shrink-0 rounded-lg object-contain"
            />
          )}
          <div className="min-w-0">
            <p className="truncate text-xs font-medium uppercase tracking-wide text-zinc-500">
              {companyName}
            </p>
            <h1 className="text-2xl font-semibold sm:text-3xl">
              {t("hello", { name: session.name?.split(" ")[0] ?? "owner" })}
            </h1>
            <p className="text-sm text-zinc-600">
              {openTill
                ? t("tillOpen", { count: openTill.cashSalesCount })
                : t("tillClosed")}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <LanguageToggle current={locale} />
          <div className="flex gap-2">
            <Link
              href="/profile"
              className="whitespace-nowrap rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm hover:bg-zinc-100"
            >
              {tc("profile")}
            </Link>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <button
                type="submit"
                className="whitespace-nowrap rounded-lg border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100"
              >
                {tc("signOut")}
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Primary: Sell */}
      <Link
        href="/sell"
        data-tour="dash-sell"
        className="mt-6 block rounded-3xl border-2 border-zinc-900 bg-zinc-900 p-6 text-white shadow-lg transition hover:shadow-xl"
      >
        <div className="flex items-center gap-4">
          <Store className="h-12 w-12 shrink-0" strokeWidth={1.5} />
          <div className="flex-1">
            <h2 className="text-2xl font-semibold">{t("sell")}</h2>
            <p className="mt-1 text-sm text-zinc-300">{t("sellSubtitle")}</p>
          </div>
          <ArrowRight className="h-6 w-6 shrink-0" strokeWidth={2} />
        </div>
      </Link>

      {/* Today's numbers */}
      <Link
        href="/sales"
        data-tour="dash-today"
        className="mt-4 grid grid-cols-3 gap-2 rounded-2xl border border-zinc-200 bg-white p-4 transition hover:border-zinc-300 hover:shadow-sm"
      >
        <div>
          <p className="text-[10px] uppercase tracking-wide text-zinc-500">
            {t("todaySales")}
          </p>
          <p className="mt-0.5 font-mono text-lg font-semibold tabular-nums">
            {today.salesCount}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-zinc-500">
            {t("todayRevenue")}
          </p>
          <p className="mt-0.5 font-mono text-lg font-semibold tabular-nums">
            {formatRWF(today.revenue)}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-zinc-500">
            {t("todayProfit")}
          </p>
          <p
            className={`mt-0.5 font-mono text-lg font-semibold tabular-nums ${
              today.profit >= 0 ? "text-green-700" : "text-red-700"
            }`}
          >
            {formatRWF(today.profit)}
          </p>
        </div>
      </Link>

      {/* Run the shop */}
      <section className="mt-8" data-tour="dash-run-shop">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          {t("runShop")}
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <DashCard
            href="/cash-sessions"
            Icon={Banknote}
            title={openTill ? t("cashOpen") : t("cashClosed")}
            subtitle={
              openTill ? t("cashSubtitleOpen") : t("cashSubtitleClosed")
            }
            tone={openTill ? "active" : "neutral"}
          />
          <DashCard
            href="/purchases"
            Icon={Package}
            title={t("receiveStock")}
            subtitle={t("receiveStockSubtitle")}
          />
          <DashCard
            href="/expenses"
            Icon={Wallet}
            title={t("expenses")}
            subtitle={t("expensesSubtitle")}
          />
          <DashCard
            href="/adjustments"
            Icon={AlertTriangle}
            title={t("losses")}
            subtitle={t("lossesSubtitle")}
          />
          <DashCard
            href="/stock-take"
            Icon={ClipboardList}
            title={t("stockTake")}
            subtitle={t("stockTakeSubtitle")}
          />
          <DashCard
            href="/coupons"
            Icon={Ticket}
            title={t("coupons")}
            subtitle={t("couponsSubtitle")}
          />
          <DashCard
            href="/sales"
            Icon={ReceiptText}
            title={t("salesHistory")}
            subtitle={t("salesHistorySubtitle")}
          />
          <DashCard
            href="/restock"
            Icon={PackagePlus}
            title={t("restock")}
            subtitle={t("restockSubtitle")}
          />
        </div>
      </section>

      {/* Stock & catalog */}
      <section className="mt-8" data-tour="dash-catalog">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          {t("stockCatalog")}
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <DashCard
            href="/products"
            Icon={ShoppingBag}
            title={t("products")}
            subtitle={t("productsSubtitle")}
          />
          <DashCard
            href="/categories"
            Icon={Tag}
            title={t("categories")}
            subtitle={t("categoriesSubtitle")}
          />
          <DashCard
            href="/suppliers"
            Icon={Truck}
            title={t("suppliers")}
            subtitle={t("suppliersSubtitle")}
          />
        </div>
      </section>

      {/* Reports & users */}
      <section className="mt-8" data-tour="dash-reports">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          {t("reportsUsers")}
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <DashCard
            href="/analytics"
            Icon={TrendingUp}
            title={t("analytics")}
            subtitle={t("analyticsSubtitle")}
            tone="active"
          />
          <DashCard
            href="/reports"
            Icon={BarChart3}
            title={t("dailySummary")}
            subtitle={t("dailySummarySubtitle")}
          />
          <DashCard
            href="/users"
            Icon={Users}
            title={t("users")}
            subtitle={t("usersSubtitle")}
          />
          <DashCard
            href="/channels"
            Icon={Tag}
            title={t("channels")}
            subtitle={t("channelsSubtitle")}
          />
          <DashCard
            href="/audit"
            Icon={ShieldCheck}
            title={t("audit")}
            subtitle={t("auditSubtitle")}
          />
          <DashCard
            href="/settings"
            Icon={SettingsIcon}
            title={t("systemConfig")}
            subtitle={t("systemConfigSubtitle")}
          />
        </div>
      </section>
    </main>
  );
}

function DashCard({
  href,
  Icon,
  title,
  subtitle,
  tone,
}: {
  href: string;
  Icon: LucideIcon;
  title: string;
  subtitle: string;
  tone?: "neutral" | "active";
}) {
  const tint =
    tone === "active"
      ? "border-green-200 bg-green-50 hover:border-green-300"
      : "border-zinc-200 bg-white hover:border-zinc-300";
  const iconTint =
    tone === "active" ? "text-green-700" : "text-zinc-700";
  return (
    <Link
      href={href}
      className={`flex items-center gap-4 rounded-2xl border p-4 transition hover:shadow-sm ${tint}`}
    >
      <Icon className={`h-7 w-7 shrink-0 ${iconTint}`} strokeWidth={1.5} />
      <div className="flex-1 min-w-0">
        <h4 className="text-base font-medium">{title}</h4>
        <p className="mt-0.5 text-xs text-zinc-600">{subtitle}</p>
      </div>
      <ArrowRight className="h-4 w-4 shrink-0 text-zinc-400" strokeWidth={2} />
    </Link>
  );
}
