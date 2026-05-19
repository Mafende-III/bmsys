import type { Channel, ChannelPriceOverride, Product } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type ChannelPriceRow = {
  channel: Channel;
  override: ChannelPriceOverride | null;
  // Effective price = override if set, else the product's default
  effectiveUnitPrice: number;
  effectiveCartonPrice: number;
};

/**
 * Returns one row per Channel (active OR inactive — caller decides which
 * to display), each with the override (if any) and the effective price
 * after applying the override-or-default rule. Channels are ordered the
 * same as on the channels list page.
 */
export async function getProductChannelPrices(
  productId: string,
): Promise<{ product: Product; rows: ChannelPriceRow[] } | null> {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) return null;

  const [channels, overrides] = await Promise.all([
    prisma.channel.findMany({ orderBy: [{ active: "desc" }, { createdAt: "asc" }] }),
    prisma.channelPriceOverride.findMany({ where: { productId } }),
  ]);

  const overrideByChannel = new Map(overrides.map((o) => [o.channelId, o]));

  const rows: ChannelPriceRow[] = channels.map((channel) => {
    const override = overrideByChannel.get(channel.id) ?? null;
    return {
      channel,
      override,
      effectiveUnitPrice: override?.unitPrice ?? product.unitPrice,
      effectiveCartonPrice: override?.cartonPrice ?? product.cartonPrice,
    };
  });

  return { product, rows };
}

/**
 * For pricing reads in sales flows (used in later sprints): get the
 * effective unit/carton price for one (product, channel) pair.
 */
export async function getEffectivePrice(
  productId: string,
  channelId: string,
): Promise<{ unitPrice: number; cartonPrice: number } | null> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { unitPrice: true, cartonPrice: true },
  });
  if (!product) return null;

  const override = await prisma.channelPriceOverride.findUnique({
    where: { productId_channelId: { productId, channelId } },
  });

  return {
    unitPrice: override?.unitPrice ?? product.unitPrice,
    cartonPrice: override?.cartonPrice ?? product.cartonPrice,
  };
}
