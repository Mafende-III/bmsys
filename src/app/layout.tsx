import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { AppShell } from "@/components/shell/AppShell";
import { getSessionUser } from "@/lib/auth-guards";
import { getOpenSession } from "@/lib/cash-sessions/queries";
import { getSettings } from "@/lib/settings/queries";
import { TourLauncher } from "./_components/TourLauncher";
import "./globals.css";

// The root layout reads from Settings on every render so a logo or
// theme change is picked up immediately without a redeploy. That
// means no page can be statically prerendered at build time (Prisma
// has no DATABASE_URL during `next build`). Opting the whole tree
// into dynamic rendering is the right call for this single-tenant
// authenticated app — every request is per-user anyway.
export const dynamic = "force-dynamic";

// iPhones with rounded displays (and the Dynamic Island) only give
// the app the full screen when viewport-fit=cover; the shell then
// pads with env(safe-area-inset-*) so chrome never hides under the
// island or the home indicator. In a normal browser tab the insets
// are 0 and this is a no-op.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export async function generateMetadata(): Promise<Metadata> {
  const { companyName, logoUrl } = await getSettings();
  return {
    title: `${companyName} — Sales & stock`,
    description: "Shop management",
    icons: {
      icon: logoUrl ? [{ url: logoUrl }] : [{ url: "/icons/icon-192.png" }],
      // Static file: iOS ignores dynamic routes for home-screen icons.
      apple: [{ url: "/icons/apple-touch-icon.png" }],
    },
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: companyName,
    },
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { theme, companyName, logoUrl } = await getSettings();
  const locale = await getLocale();
  const messages = await getMessages();
  const sessionUser = await getSessionUser();
  const user = sessionUser
    ? { name: sessionUser.name ?? "", role: sessionUser.role }
    : null;
  const tillOpen = user ? Boolean(await getOpenSession()) : false;
  return (
    <html lang={locale} data-theme={theme}>
      <body className="min-h-screen text-zinc-900 antialiased">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <AppShell
            user={user}
            companyName={companyName}
            logoUrl={logoUrl}
            tillOpen={tillOpen}
          >
            {children}
          </AppShell>
          <TourLauncher />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
