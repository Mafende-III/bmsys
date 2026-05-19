import type { Prisma } from "@prisma/client";
import type { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { withIdempotency } from "@/lib/idempotency";
import { upsertPriceOverridesSchema } from "./schema";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function firstError(error: ZodError): string {
  return error.errors[0]?.message ?? "Invalid input";
}

function errorMessage(e: unknown, fallback: string): string {
  return e instanceof Error ? e.message : fallback;
}

/**
 * Atomically reconcile the per-channel overrides for a single product.
 *
 * For each (productId, channelId) in `overrides`:
 *   - both unitPrice AND cartonPrice null → delete the row (keep table sparse)
 *   - at least one non-null → upsert with the provided values (other field null is allowed)
 *
 * Writes one AuditLog row per actual change (created / updated / deleted).
 * Unchanged rows produce no audit entry.
 */
export async function upsertPriceOverridesOp(
  userId: string,
  idempotencyKey: string,
  raw: unknown,
): Promise<ActionResult<{ productId: string; changed: number }>> {
  const parsed = upsertPriceOverridesSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const { productId, overrides } = parsed.data;

  try {
    const result = await withIdempotency(
      idempotencyKey,
      `channelPrices.upsert.${productId}`,
      () =>
        prisma.$transaction(async (tx) => {
          // Guard: product must exist and be active. Pricing an archived
          // product makes no sense; bail loudly rather than silently.
          const product = await tx.product.findUnique({
            where: { id: productId },
            select: { id: true, active: true },
          });
          if (!product) throw new Error("Product not found");
          if (!product.active) {
            throw new Error("Cannot edit prices for an archived product");
          }

          // Validate channel ids exist before touching any rows.
          const channelIds = overrides.map((o) => o.channelId);
          const existingChannels = await tx.channel.findMany({
            where: { id: { in: channelIds } },
            select: { id: true },
          });
          const knownChannelIds = new Set(existingChannels.map((c) => c.id));
          for (const o of overrides) {
            if (!knownChannelIds.has(o.channelId)) {
              throw new Error(`Unknown channel: ${o.channelId}`);
            }
          }

          // Index current overrides for this product so we can detect changes.
          const current = await tx.channelPriceOverride.findMany({
            where: { productId },
          });
          const currentByChannel = new Map(
            current.map((o) => [o.channelId, o]),
          );

          let changed = 0;

          for (const o of overrides) {
            const existing = currentByChannel.get(o.channelId) ?? null;
            const wantsDelete =
              o.unitPrice === null && o.cartonPrice === null;

            if (wantsDelete) {
              if (existing) {
                await tx.channelPriceOverride.delete({
                  where: { id: existing.id },
                });
                await tx.auditLog.create({
                  data: {
                    tableName: "channel_price_overrides",
                    recordId: existing.id,
                    action: "DELETE",
                    changes: { before: existing } as unknown as Prisma.InputJsonValue,
                    userId,
                  },
                });
                changed += 1;
              }
              continue;
            }

            // Upsert path
            const desired = {
              unitPrice: o.unitPrice,
              cartonPrice: o.cartonPrice,
            };

            if (
              existing &&
              existing.unitPrice === desired.unitPrice &&
              existing.cartonPrice === desired.cartonPrice
            ) {
              continue; // no change
            }

            const upserted = await tx.channelPriceOverride.upsert({
              where: {
                productId_channelId: {
                  productId,
                  channelId: o.channelId,
                },
              },
              create: {
                productId,
                channelId: o.channelId,
                unitPrice: desired.unitPrice,
                cartonPrice: desired.cartonPrice,
              },
              update: {
                unitPrice: desired.unitPrice,
                cartonPrice: desired.cartonPrice,
              },
            });

            await tx.auditLog.create({
              data: {
                tableName: "channel_price_overrides",
                recordId: upserted.id,
                action: existing ? "UPDATE" : "INSERT",
                changes: {
                  before: existing,
                  after: upserted,
                } as unknown as Prisma.InputJsonValue,
                userId,
              },
            });
            changed += 1;
          }

          return { productId, changed };
        }),
    );
    return { ok: true, data: result };
  } catch (e: unknown) {
    return { ok: false, error: errorMessage(e, "Failed to save prices") };
  }
}
