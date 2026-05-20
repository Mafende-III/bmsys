import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
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

export async function generateMetadata(): Promise<Metadata> {
  const { companyName, logoUrl } = await getSettings();
  return {
    title: `${companyName} — Sales & stock`,
    description: "Shop management",
    icons: logoUrl
      ? {
          icon: [{ url: logoUrl }],
          apple: [{ url: logoUrl }],
        }
      : undefined,
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { theme } = await getSettings();
  const locale = await getLocale();
  const messages = await getMessages();
  return (
    <html lang={locale} data-theme={theme}>
      <body className="min-h-screen text-zinc-900 antialiased">
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
          <TourLauncher />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
