import type { Metadata } from "next";
import { getSettings } from "@/lib/settings/queries";
import "./globals.css";

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
  return (
    <html lang="en" data-theme={theme}>
      <body className="min-h-screen text-zinc-900 antialiased">{children}</body>
    </html>
  );
}
