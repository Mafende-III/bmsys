import { prisma } from "@/lib/prisma";
import type { ThemeKey } from "./schema";

export type AppSettings = {
  companyName: string;
  theme: ThemeKey;
  logoPath: string | null;
  logoUrl: string | null;
  updatedAt: Date;
};

const DEFAULT_SETTINGS: AppSettings = {
  companyName: "HydroMart Shop",
  theme: "default",
  logoPath: null,
  logoUrl: null,
  updatedAt: new Date(0),
};

/**
 * Returns the org Settings row. Creates it on first read so the rest
 * of the app can assume it exists. logoUrl is cache-busted by the
 * row's updatedAt so a newly-uploaded logo replaces the old one in
 * browsers immediately.
 *
 * Falls back to in-memory defaults if Prisma can't reach the DB —
 * this lets `next build` render layouts that call this helper even
 * though no DATABASE_URL is wired during the build phase.
 */
export async function getSettings(): Promise<AppSettings> {
  try {
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
  } catch {
    return DEFAULT_SETTINGS;
  }
}
