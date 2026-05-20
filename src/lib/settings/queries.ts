import { prisma } from "@/lib/prisma";
import type { ThemeKey } from "./schema";

export type AppSettings = {
  companyName: string;
  theme: ThemeKey;
  logoPath: string | null;
  logoUrl: string | null;
  updatedAt: Date;
};

/**
 * Returns the org Settings row. Creates it on first read so the rest
 * of the app can assume it exists. logoUrl is cache-busted by the
 * row's updatedAt so a newly-uploaded logo replaces the old one in
 * browsers immediately.
 */
export async function getSettings(): Promise<AppSettings> {
  const row = await prisma.settings.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default" },
  });
  const logoUrl = row.logoPath
    ? `/uploads/${row.logoPath}?v=${row.updatedAt.getTime()}`
    : null;
  return {
    companyName: row.companyName,
    theme: row.theme as ThemeKey,
    logoPath: row.logoPath,
    logoUrl,
    updatedAt: row.updatedAt,
  };
}
