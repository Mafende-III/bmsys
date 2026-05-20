import Link from "next/link";
import { AlertTriangle, LogOut } from "lucide-react";
import { signOut } from "@/lib/auth";
import { requireSeller } from "@/lib/auth-guards";
import { getOpenSession } from "@/lib/cash-sessions/queries";
import { listAllowedChannels } from "@/lib/permissions";
import { getActiveChannelId } from "@/lib/sales/actions";
import { getSettings } from "@/lib/settings/queries";
import { CartProvider } from "./_components/CartProvider";
import { CartHeader } from "./_components/CartHeader";
import { ChannelPicker } from "./_components/ChannelPicker";
import {
  QuickActionsMenu,
  type QuickAction,
} from "./_components/QuickActionsMenu";

export default async function SellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireSeller();
  const allowedChannels = await listAllowedChannels(user.id);
  const { companyName, logoUrl } = await getSettings();

  if (allowedChannels.length === 0) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col p-4 sm:p-6">
        <header className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Sell</h1>
            <p className="text-sm text-zinc-600">Hi {user.name}.</p>
          </div>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button
              type="submit"
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100"
            >
              Sign out
            </button>
          </form>
        </header>

        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          You aren&apos;t set up to sell on any channel yet. Ask the owner to
          give you access to at least one channel.
        </div>
      </main>
    );
  }

  const cookieChannelId = await getActiveChannelId();
  const allowedIds = new Set(allowedChannels.map((c) => c.id));
  const activeChannelId =
    cookieChannelId && allowedIds.has(cookieChannelId)
      ? cookieChannelId
      : (allowedChannels[0]?.id ?? "");
  const activeChannel = allowedChannels.find((c) => c.id === activeChannelId);
  const openSession = await getOpenSession();

  // Owner-only quick actions visible inside POS mode. Icons are
  // passed as string keys so the layout (server component) can hand
  // them to QuickActionsMenu (client component) — component refs
  // can't cross the boundary.
  const ownerActions: QuickAction[] = [
    openSession
      ? {
          href: "/cash-sessions",
          label: "Close till",
          icon: "banknote",
          hint: `Open since ${new Date(openSession.openedAt).toLocaleTimeString()}`,
        }
      : {
          href: "/cash-sessions",
          label: "Open till",
          icon: "banknote",
          hint: "Required before cash sales",
        },
    {
      href: "/expenses/new",
      label: "Log an expense",
      icon: "wallet",
      hint: "Rent, fuel, transport…",
    },
    {
      href: "/purchases/new",
      label: "Receive stock",
      icon: "package",
      hint: "Log a purchase from a supplier",
    },
    {
      href: "/adjustments/new",
      label: "Record loss",
      icon: "warning",
      hint: "Broken, expired, stolen, sample",
    },
    {
      href: "/reports",
      label: "Today's summary",
      icon: "chart",
    },
    {
      href: "/dashboard",
      label: "Exit POS",
      icon: "back",
      hint: "Back to admin",
    },
  ];

  return (
    <CartProvider currentChannelId={activeChannelId}>
      <div className="flex min-h-screen flex-col">
        {/* Compact top bar */}
        <header className="app-header border-b border-zinc-200 bg-white px-4 py-2 sm:px-6">
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              {logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoUrl}
                  alt=""
                  className="h-8 w-8 shrink-0 rounded-md object-contain"
                />
              )}
              <span
                className="hidden truncate text-sm font-medium text-zinc-800 sm:inline"
                title={companyName}
              >
                {companyName}
              </span>
              <div className="min-w-0 flex-1">
                <ChannelPicker
                  channels={allowedChannels.map((c) => ({
                    id: c.id,
                    name: c.name,
                  }))}
                  currentChannelId={activeChannelId}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              {user.role === "OWNER" ? (
                <QuickActionsMenu ownerActions={ownerActions} />
              ) : null}
              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/login" });
                }}
              >
                <button
                  type="submit"
                  aria-label="Sign out"
                  className="rounded-lg border border-zinc-300 p-2 hover:bg-zinc-100"
                >
                  <LogOut className="h-5 w-5 text-zinc-700" strokeWidth={2} />
                </button>
              </form>
            </div>
          </div>
        </header>

        {!openSession && (
          <div className="mx-4 mt-2 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 sm:mx-auto sm:max-w-2xl">
            <AlertTriangle className="h-4 w-4 shrink-0" strokeWidth={2} />
            <p className="flex-1">
              The till is closed. Cash sales will be refused.{" "}
              {user.role === "OWNER" && (
                <Link href="/cash-sessions" className="font-medium underline">
                  Open it
                </Link>
              )}
            </p>
          </div>
        )}

        {/* Content — bottom padding so the sticky cart bar doesn't cover it */}
        <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-32 pt-3 sm:px-6">
          {children}
        </main>

        {/* Sticky cart bar at the bottom (renders nothing when cart is empty) */}
        <CartHeader channelName={activeChannel?.name ?? "—"} />
      </div>
    </CartProvider>
  );
}
