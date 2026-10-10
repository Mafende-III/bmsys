"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  BarChart3,
  Check,
  Droplets,
  MoreHorizontal,
  Package,
  ShoppingCart,
  Wallet,
  X,
} from "lucide-react";
import { Keycap, StatusPill } from "@/components/ui";
import { cn } from "@/lib/cn";

type ShellUser = { name: string; role: string };

type TabDef = {
  key: string;
  labelKey: string;
  href: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  /** Path prefixes that light this tab up. */
  match: string[];
};

const OWNER_TABS: TabDef[] = [
  {
    key: "money",
    labelKey: "money",
    href: "/dashboard",
    icon: Wallet,
    match: [
      "/dashboard",
      "/expenses",
      "/cash-sessions",
      "/coupons",
      "/working-capital",
    ],
  },
  {
    key: "stock",
    labelKey: "stock",
    href: "/products",
    icon: Package,
    match: [
      "/products",
      "/purchases",
      "/restock",
      "/stock-take",
      "/adjustments",
      "/suppliers",
      "/categories",
    ],
  },
  {
    key: "reports",
    labelKey: "reports",
    href: "/analytics",
    icon: BarChart3,
    match: ["/analytics", "/reports", "/sales", "/my-day"],
  },
  {
    key: "more",
    labelKey: "more",
    href: "/settings",
    icon: MoreHorizontal,
    match: ["/settings", "/users", "/channels", "/activity", "/profile"],
  },
];

const SELLER_TABS: TabDef[] = [
  {
    key: "till",
    labelKey: "till",
    href: "/cash-sessions",
    icon: Wallet,
    match: ["/cash-sessions"],
  },
  {
    key: "myday",
    labelKey: "myDay",
    href: "/my-day",
    icon: BarChart3,
    match: ["/my-day", "/profile"],
  },
];

function isActive(tab: TabDef, pathname: string) {
  return tab.match.some(
    (m) => pathname === m || pathname.startsWith(`${m}/`),
  );
}

function Logo({ logoUrl }: { logoUrl: string | null }) {
  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt=""
        className="h-9 w-9 shrink-0 rounded-panel object-contain"
      />
    );
  }
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-panel bg-ink">
      <Droplets className="h-5 w-5 text-primary-fill" strokeWidth={2.2} />
    </span>
  );
}

function SellFab({
  active,
  className,
}: {
  active: boolean;
  className?: string;
}) {
  const t = useTranslations("shell");
  return (
    <Link
      href="/sell"
      aria-label={t("sell")}
      data-tour="shell-sell"
      className={cn(
        "flex h-[58px] w-[58px] items-center justify-center rounded-full text-white active:translate-y-[2px]",
        active ? "bg-fab-active shadow-fab-active" : "bg-fab shadow-fab",
        className,
      )}
    >
      <ShoppingCart className="h-6 w-6" strokeWidth={2.2} />
    </Link>
  );
}

/**
 * The register shell: persistent logo header, bottom tab bar with a
 * floating Sell button on phones, icon rail on lg+. The POS keeps
 * its own chrome, so the shell steps aside under /sell; /login gets
 * nothing. Content, not chrome, stays the page's job.
 */
export function AppShell({
  user,
  companyName,
  logoUrl,
  tillOpen,
  children,
}: {
  user: ShellUser | null;
  companyName: string;
  logoUrl: string | null;
  tillOpen: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const t = useTranslations("shell");

  const bare =
    !user || pathname === "/login" || pathname.startsWith("/sell");
  if (bare) return <>{children}</>;

  const tabs = user.role === "OWNER" ? OWNER_TABS : SELLER_TABS;
  const sellActive = pathname.startsWith("/sell");
  const initial = (user.name?.trim()[0] ?? "?").toUpperCase();

  return (
    <div className="min-h-screen">
      {/* Persistent header */}
      <header className="sticky top-0 z-30 border-b border-rule-hair bg-surface">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-3 px-4">
          <Link
            href={user.role === "OWNER" ? "/dashboard" : "/sell"}
            className="flex min-w-0 items-center gap-2.5"
            data-tour="shell-logo"
          >
            <Logo logoUrl={logoUrl} />
            <span className="truncate text-base font-extrabold tracking-tight text-ink">
              {companyName}
            </span>
          </Link>
          <div className="flex-1" />
          <StatusPill
            tone={tillOpen ? "success" : "warning"}
            icon={
              tillOpen ? (
                <Check className="h-3 w-3" strokeWidth={3} />
              ) : (
                <X className="h-3 w-3" strokeWidth={3} />
              )
            }
          >
            {tillOpen ? t("tillOpen") : t("tillClosed")}
          </StatusPill>
          <Link
            href="/profile"
            aria-label={t("profile")}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-sunk text-sm font-extrabold text-primary ring-1 ring-inset ring-rule"
          >
            {initial}
          </Link>
        </div>
      </header>

      <div className="lg:flex">
        {/* Desktop rail */}
        <nav
          aria-label="Primary"
          className="sticky top-16 hidden h-[calc(100vh-4rem)] w-[88px] shrink-0 flex-col items-center gap-1 border-r border-rule-hair bg-surface pt-5 lg:flex"
        >
          <SellFab active={sellActive} />
          <span
            className={cn(
              "mb-3 mt-1 text-[11px] font-bold",
              sellActive ? "text-primary" : "text-ink",
            )}
          >
            {t("sell")}
          </span>
          {tabs.map((tab) => (
            <Keycap
              key={tab.key}
              href={tab.href}
              size="lg"
              label={t(tab.labelKey)}
              pressed={isActive(tab, pathname)}
              className="mb-2"
              aria-label={t(tab.labelKey)}
            >
              <tab.icon className="h-[22px] w-[22px]" strokeWidth={2} />
            </Keycap>
          ))}
        </nav>

        {/* Page content — clears the fixed tab bar on phones */}
        <div className="min-w-0 flex-1 pb-32 lg:pb-8">{children}</div>
      </div>

      {/* Mobile tab bar + floating Sell */}
      <nav
        aria-label="Primary"
        data-tour="shell-tabbar"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-rule-hair bg-surface pb-[max(14px,env(safe-area-inset-bottom))] pt-2 lg:hidden"
      >
        <div className="relative mx-auto flex max-w-md items-end px-2">
          {tabs.slice(0, Math.ceil(tabs.length / 2)).map((tab) => (
            <Keycap
              key={tab.key}
              href={tab.href}
              label={t(tab.labelKey)}
              pressed={isActive(tab, pathname)}
              className="flex-1"
              aria-label={t(tab.labelKey)}
            >
              <tab.icon className="h-[20px] w-[20px]" strokeWidth={2} />
            </Keycap>
          ))}
          <span className="flex flex-1 flex-col items-center justify-end">
            <span
              className={cn(
                "text-[11px] font-bold",
                sellActive ? "text-primary" : "text-ink",
              )}
            >
              {t("sell")}
            </span>
          </span>
          {tabs.slice(Math.ceil(tabs.length / 2)).map((tab) => (
            <Keycap
              key={tab.key}
              href={tab.href}
              label={t(tab.labelKey)}
              pressed={isActive(tab, pathname)}
              className="flex-1"
              aria-label={t(tab.labelKey)}
            >
              <tab.icon className="h-[20px] w-[20px]" strokeWidth={2} />
            </Keycap>
          ))}
          <SellFab
            active={sellActive}
            className="absolute -top-8 left-1/2 -translate-x-1/2"
          />
        </div>
      </nav>
    </div>
  );
}
