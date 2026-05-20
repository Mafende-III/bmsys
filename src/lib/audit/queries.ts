import { prisma } from "@/lib/prisma";
import {
  AUDIT_CATEGORIES,
  type AuditCategory,
} from "./categories";

export type SecurityEventRow = {
  id: string;
  createdAt: Date;
  category: AuditCategory;
  tableName: string;
  recordId: string;
  changes: unknown;
  userId: string | null;
  userName: string | null;
};

/**
 * Lists categorized audit-log rows for the owner-facing /audit
 * screen. Uncategorized mutations are intentionally excluded — this
 * view is for the curated security feed, not the raw firehose.
 */
export async function listSecurityEvents(opts: {
  category?: AuditCategory | "all";
  sinceDays?: number;
  limit?: number;
} = {}): Promise<SecurityEventRow[]> {
  const { category = "all", sinceDays = 30, limit = 200 } = opts;
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);

  const rows = await prisma.auditLog.findMany({
    where: {
      category:
        category === "all"
          ? { in: AUDIT_CATEGORIES as readonly string[] as string[] }
          : category,
      createdAt: { gte: since },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      createdAt: true,
      category: true,
      tableName: true,
      recordId: true,
      changes: true,
      userId: true,
      user: { select: { name: true } },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    createdAt: r.createdAt,
    category: r.category as AuditCategory,
    tableName: r.tableName,
    recordId: r.recordId,
    changes: r.changes,
    userId: r.userId,
    userName: r.user?.name ?? null,
  }));
}
