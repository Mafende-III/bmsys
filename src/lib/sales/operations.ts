import type { Prisma } from "@prisma/client";
import type { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { withIdempotency } from "@/lib/idempotency";
import { userCanSellOnChannel } from "@/lib/permissions";
import { createSaleSchema } from "./schema";
import { maxAllowedLineDiscount } from "./floor";

export { maxAllowedLineDiscount };

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
        // Role check is needed up-front so we can decide whether to
        // honour any floorOverride flags the caller passed in.
        const user = await tx.user.findUnique({
          where: { id: userId },
          select: { role: true },
        });
        const isOwner = user?.role === "OWNER";

        // Resolve the global default margin floor. Per-product floors
        // override this; products that set 0 fall back here.
        const settings = await tx.settings.findUnique({
          where: { id: "default" },
          select: { defaultMinMarginBps: true },
        });
        const defaultMinMarginBps = settings?.defaultMinMarginBps ?? 0;

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

        // CASH sales require an open cash session (per CLAUDE.md rule
        // 2.2 — transactional cash session updates). MOMO/BANK don't.
        if (input.paymentMethod === "CASH") {
          const openSession = await tx.cashSession.findFirst({
            where: { closedAt: null },
          });
          if (!openSession) {
            throw new Error(
              "Till is closed. Open a cash session before recording cash sales.",
            );
          }
        }

        let total = 0;
        const linePlans: Array<{
          productId: string;
          unitsPerCarton: number;
          saleUnit: "UNIT" | "CARTON";
          qty: number;
          unitPrice: number;
          discountAmount: number;
          discountReason: string | null;
          floorOverride: boolean;
          lineTotal: number;
          cartonId: string | null;
        }> = [];
        const discountAudit: Array<{
          productId: string;
          sku: string;
          name: string;
          discountAmount: number;
          discountReason: string | null;
          floorOverride: boolean;
          maxAllowedAtFloor: number;
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
          const grossLineTotal = unitPrice * item.qty;

          // ── Discount + min-margin floor ─────────────────────────────
          // Per-product margin overrides the global default; 0 means
          // "use the global default", and 0 there means "no floor".
          const effectiveMarginBps =
            product.minMarginBps > 0
              ? product.minMarginBps
              : defaultMinMarginBps;
          const maxAllowed = maxAllowedLineDiscount({
            saleUnit: item.saleUnit,
            qty: item.qty,
            unitPrice,
            costPerCarton: product.costPerCarton,
            unitsPerCarton: product.unitsPerCarton,
            marginBps: effectiveMarginBps,
          });
          const requestedDiscount = item.discountAmount;
          // Only OWNER may bypass the floor. Sellers' overrides are
          // silently dropped — schema-level defence in depth.
          const floorOverride = isOwner && item.floorOverride === true;
          if (requestedDiscount > grossLineTotal) {
            throw new Error(
              `${product.name}: discount of RWF ${requestedDiscount} exceeds the line price of RWF ${grossLineTotal}`,
            );
          }
          if (!floorOverride && requestedDiscount > maxAllowed) {
            if (product.costPerCarton <= 0) {
              throw new Error(
                `${product.name}: set a purchase cost on the product before applying a discount`,
              );
            }
            throw new Error(
              `${product.name}: max discount at the ${(effectiveMarginBps / 100).toFixed(1)}% margin floor is RWF ${maxAllowed}`,
            );
          }
          const lineTotal = grossLineTotal - requestedDiscount;

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
            discountAmount: requestedDiscount,
            discountReason: item.discountReason ?? null,
            floorOverride,
            lineTotal,
            cartonId,
          });
          if (requestedDiscount > 0) {
            discountAudit.push({
              productId: product.id,
              sku: product.sku,
              name: product.name,
              discountAmount: requestedDiscount,
              discountReason: item.discountReason ?? null,
              floorOverride,
              maxAllowedAtFloor: maxAllowed,
            });
          }
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
              discountAmount: plan.discountAmount,
              discountReason: plan.discountReason,
              floorOverride: plan.floorOverride,
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

        const discountTotal = discountAudit.reduce(
          (a, d) => a + d.discountAmount,
          0,
        );
        await tx.auditLog.create({
          data: {
            tableName: "sales",
            recordId: sale.id,
            action: "INSERT",
            category: discountAudit.length > 0 ? "SALE_DISCOUNT" : null,
            changes: {
              channelId: input.channelId,
              paymentMethod: input.paymentMethod,
              itemCount: input.items.length,
              total,
              ...(discountAudit.length > 0
                ? {
                    discountTotal,
                    discounts: discountAudit,
                    floorOverrideApplied: discountAudit.some(
                      (d) => d.floorOverride,
                    ),
                  }
                : {}),
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
