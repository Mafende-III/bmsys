import type { Prisma } from "@prisma/client";
import type { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { withIdempotency } from "@/lib/idempotency";
import { userCanSellOnChannel } from "@/lib/permissions";
import { createSaleSchema } from "./schema";

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
 * Atomically:
 *   1. Verify caller may sell on this channel
 *   2. Resolve effective prices and check stock for each line
 *   3. For UNIT lines: pick or auto-open a carton, decrement it
 *   4. For CARTON lines: check sealed carton availability
 *   5. Insert Sale + SaleLines + stock_moves + AuditLog
 *
 * Rules baked in:
 *   - UNIT lines refuse if qty > product.unitsPerCarton (force CARTON or
 *     split into smaller lines)
 *   - SALE_UNIT picks oldest OPENED carton with enough remaining; if not,
 *     auto-opens a new carton from sealed stock
 *   - SALE_CARTON requires sealed_cartons >= qty
 */
export async function createSaleOp(
  userId: string,
  idempotencyKey: string,
  raw: unknown,
): Promise<ActionResult<{ saleId: string; total: number }>> {
  const parsed = createSaleSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const input = parsed.data;

  // Permission check (outside the transaction — cheap and avoids opening
  // a tx for an unauthorized request).
  if (!(await userCanSellOnChannel(userId, input.channelId))) {
    return { ok: false, error: "You are not authorized to sell on this channel" };
  }

  try {
    const result = await withIdempotency(idempotencyKey, "sales.create", () =>
      prisma.$transaction(async (tx) => {
        const productIds = input.items.map((i) => i.productId);
        const products = await tx.product.findMany({
          where: { id: { in: productIds } },
        });
        const byId = new Map(products.map((p) => [p.id, p]));

        // Validate channel exists + active
        const channel = await tx.channel.findUnique({
          where: { id: input.channelId },
        });
        if (!channel) throw new Error("Channel not found");
        if (!channel.active) throw new Error("Channel is inactive");

        let total = 0;
        const linePlans: Array<{
          productId: string;
          unitsPerCarton: number;
          saleUnit: "UNIT" | "CARTON";
          qty: number;
          unitPrice: number;
          lineTotal: number;
          cartonId: string | null;
        }> = [];

        for (const item of input.items) {
          const product = byId.get(item.productId);
          if (!product) throw new Error(`Unknown product: ${item.productId}`);
          if (!product.active) throw new Error(`${product.name} is archived`);

          if (item.saleUnit === "UNIT" && !product.sellableAsUnit) {
            throw new Error(`${product.name} cannot be sold as unit`);
          }
          if (item.saleUnit === "CARTON" && !product.sellableAsCarton) {
            throw new Error(`${product.name} cannot be sold as carton`);
          }

          // Resolve effective price for this (product, channel)
          const override = await tx.channelPriceOverride.findUnique({
            where: {
              productId_channelId: {
                productId: product.id,
                channelId: input.channelId,
              },
            },
          });
          const unitPrice =
            item.saleUnit === "UNIT"
              ? (override?.unitPrice ?? product.unitPrice)
              : (override?.cartonPrice ?? product.cartonPrice);
          const lineTotal = unitPrice * item.qty;

          // Stock + carton handling
          let cartonId: string | null = null;

          if (item.saleUnit === "UNIT") {
            if (item.qty > product.unitsPerCarton) {
              throw new Error(
                `${product.name}: a UNIT sale can carry at most ${product.unitsPerCarton} unit(s). Use a CARTON sale or split into smaller lines.`,
              );
            }

            const openedCarton = await tx.carton.findFirst({
              where: { productId: product.id, state: "OPENED" },
              orderBy: { openedAt: "asc" },
            });

            if (openedCarton && openedCarton.unitsRemaining >= item.qty) {
              const willGoEmpty = openedCarton.unitsRemaining === item.qty;
              await tx.carton.update({
                where: { id: openedCarton.id },
                data: {
                  unitsRemaining: { decrement: item.qty },
                  ...(willGoEmpty
                    ? { state: "EMPTY", closedAt: new Date() }
                    : {}),
                },
              });
              cartonId = openedCarton.id;
            } else {
              // Need a fresh OPENED carton from sealed stock
              const stockSum = await tx.stockMove.aggregate({
                where: { productId: product.id },
                _sum: { qtyUnits: true },
              });
              const totalUnits = stockSum._sum.qtyUnits ?? 0;

              const allOpened = await tx.carton.aggregate({
                where: { productId: product.id, state: "OPENED" },
                _sum: { unitsRemaining: true },
              });
              const openedUnits = allOpened._sum.unitsRemaining ?? 0;

              const sealedUnits = totalUnits - openedUnits;
              if (sealedUnits < product.unitsPerCarton) {
                if (openedCarton) {
                  throw new Error(
                    `${product.name}: open carton has only ${openedCarton.unitsRemaining} unit(s) and no sealed cartons available.`,
                  );
                }
                throw new Error(`${product.name}: out of stock`);
              }

              const tag = `AUTO-${product.sku}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
              const willGoEmpty = item.qty === product.unitsPerCarton;
              const newCarton = await tx.carton.create({
                data: {
                  productId: product.id,
                  tag,
                  state: willGoEmpty ? "EMPTY" : "OPENED",
                  unitsRemaining: product.unitsPerCarton - item.qty,
                  openedByUserId: userId,
                  ...(willGoEmpty ? { closedAt: new Date() } : {}),
                },
              });
              await tx.stockMove.create({
                data: {
                  productId: product.id,
                  qtyUnits: 0,
                  reason: "CARTON_OPEN",
                  refType: "carton",
                  refId: newCarton.id,
                  userId,
                },
              });
              cartonId = newCarton.id;
            }
          } else {
            // CARTON sale — check sealed cartons available
            const stockSum = await tx.stockMove.aggregate({
              where: { productId: product.id },
              _sum: { qtyUnits: true },
            });
            const totalUnits = stockSum._sum.qtyUnits ?? 0;

            const allOpened = await tx.carton.aggregate({
              where: { productId: product.id, state: "OPENED" },
              _sum: { unitsRemaining: true },
            });
            const openedUnits = allOpened._sum.unitsRemaining ?? 0;

            const sealedUnits = totalUnits - openedUnits;
            const requiredUnits = item.qty * product.unitsPerCarton;
            if (sealedUnits < requiredUnits) {
              const availableCartons = Math.floor(
                sealedUnits / product.unitsPerCarton,
              );
              throw new Error(
                `${product.name}: only ${availableCartons} sealed carton(s) available`,
              );
            }
          }

          total += lineTotal;
          linePlans.push({
            productId: product.id,
            unitsPerCarton: product.unitsPerCarton,
            saleUnit: item.saleUnit,
            qty: item.qty,
            unitPrice,
            lineTotal,
            cartonId,
          });
        }

        // Create the Sale row
        const sale = await tx.sale.create({
          data: {
            channelId: input.channelId,
            paymentMethod: input.paymentMethod,
            paymentReference: input.paymentReference ?? null,
            total,
            amountPaid: total,
            amountCredit: 0,
            source: "IN_PERSON",
            status: "COMPLETE",
            userId,
          },
        });

        // Create sale lines + stock moves
        for (const plan of linePlans) {
          await tx.saleLine.create({
            data: {
              saleId: sale.id,
              productId: plan.productId,
              saleUnit: plan.saleUnit,
              qty: plan.qty,
              unitPrice: plan.unitPrice,
              lineTotal: plan.lineTotal,
              cartonId: plan.cartonId,
            },
          });

          const qtyUnitsDelta =
            plan.saleUnit === "UNIT"
              ? -plan.qty
              : -plan.qty * plan.unitsPerCarton;

          await tx.stockMove.create({
            data: {
              productId: plan.productId,
              qtyUnits: qtyUnitsDelta,
              reason: plan.saleUnit === "UNIT" ? "SALE_UNIT" : "SALE_CARTON",
              refType: "sale",
              refId: sale.id,
              userId,
            },
          });
        }

        await tx.auditLog.create({
          data: {
            tableName: "sales",
            recordId: sale.id,
            action: "INSERT",
            changes: {
              channelId: input.channelId,
              paymentMethod: input.paymentMethod,
              itemCount: input.items.length,
              total,
            } as Prisma.InputJsonValue,
            userId,
          },
        });

        return { saleId: sale.id, total };
      }),
    );
    return { ok: true, data: result };
  } catch (e: unknown) {
    return { ok: false, error: errorMessage(e, "Failed to record sale") };
  }
}
