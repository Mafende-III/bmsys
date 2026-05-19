/**
 * Per-user channel permissions.
 *
 * - OWNERs are allowed on every channel and bypass the UserChannel join table.
 * - SELLERs must have an explicit UserChannel row for a channel to sell on it.
 * - Deactivated users are allowed on no channel.
 */
import type { Channel } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type AllowedChannels = "ALL" | string[];

export async function getAllowedChannelIds(
  userId: string,
): Promise<AllowedChannels> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      active: true,
      channels: { select: { channelId: true } },
    },
  });
  if (!user || !user.active) return [];
  if (user.role === "OWNER") return "ALL";
  return user.channels.map((c) => c.channelId);
}

export async function userCanSellOnChannel(
  userId: string,
  channelId: string,
): Promise<boolean> {
  const allowed = await getAllowedChannelIds(userId);
  if (allowed === "ALL") return true;
  return allowed.includes(channelId);
}

/**
 * Active channels the user is allowed to sell on, ordered by creation
 * (so seeded channels come first).
 */
export async function listAllowedChannels(userId: string): Promise<Channel[]> {
  const allowed = await getAllowedChannelIds(userId);
  if (allowed === "ALL") {
    return prisma.channel.findMany({
      where: { active: true },
      orderBy: { createdAt: "asc" },
    });
  }
  if (allowed.length === 0) return [];
  return prisma.channel.findMany({
    where: { id: { in: allowed }, active: true },
    orderBy: { createdAt: "asc" },
  });
}
