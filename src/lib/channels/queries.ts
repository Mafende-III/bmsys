import type { Channel, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type ChannelFilters = {
  search?: string;
  active?: boolean | "all";
};

export type ChannelWithUsage = Channel & {
  customerCount: number;
  recentSales: number;
};

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * List channels with usage metrics (3 batched queries, not N+1).
 * `recentSales` counts sales in the last 30 days — used by the
 * deactivate guard and shown on the list to surface "active" channels
 * even when `active=true` is just a flag.
 */
export async function listChannelsWithUsage(
  filters: ChannelFilters = {},
): Promise<ChannelWithUsage[]> {
  const where: Prisma.ChannelWhereInput = {};

  if (filters.active !== "all") {
    where.active = filters.active ?? true;
  }

  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: "insensitive" } },
      { slug: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  const channels = await prisma.channel.findMany({
    where,
    orderBy: [{ active: "desc" }, { createdAt: "asc" }],
  });

  if (channels.length === 0) return [];

  const ids = channels.map((c) => c.id);
  const since = new Date(Date.now() - THIRTY_DAYS_MS);

  const [customerCounts, salesCounts] = await Promise.all([
    prisma.customer.groupBy({
      by: ["primaryChannelId"],
      where: { primaryChannelId: { in: ids } },
      _count: { _all: true },
    }),
    prisma.sale.groupBy({
      by: ["channelId"],
      where: { channelId: { in: ids }, date: { gte: since } },
      _count: { _all: true },
    }),
  ]);

  const customersById = new Map(
    customerCounts.map((r) => [r.primaryChannelId ?? "", r._count._all]),
  );
  const salesById = new Map(
    salesCounts.map((r) => [r.channelId, r._count._all]),
  );

  return channels.map((c) => ({
    ...c,
    customerCount: customersById.get(c.id) ?? 0,
    recentSales: salesById.get(c.id) ?? 0,
  }));
}

export async function getChannel(id: string) {
  return prisma.channel.findUnique({ where: { id } });
}

export async function getChannelUsage(id: string): Promise<{
  customerCount: number;
  recentSales: number;
}> {
  const since = new Date(Date.now() - THIRTY_DAYS_MS);
  const [customerCount, recentSales] = await Promise.all([
    prisma.customer.count({ where: { primaryChannelId: id } }),
    prisma.sale.count({ where: { channelId: id, date: { gte: since } } }),
  ]);
  return { customerCount, recentSales };
}
