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
 *   2. Look up and validate any redeemed coupon code (exists/active/
 *      not-expired/not-revoked/not-redeemed)
 *   3. Resolve effective prices and stock for each line
 *   4. Compute per-line discount from the coupon (PERCENT applies to
 *      each line; FIXED + productId applies to the matched line; FIXED
 *      cart-wide distributes proportionally across lines)
 *   5. Enforce per-product min-margin floor unless the coupon was
 *      created with allowFloorOverride
 *   6. For UNIT lines: pick or auto-open a carton, decrement it
 *   7. For CARTON lines: check sealed carton availability
 *   8. Insert Sale + SaleLines + stock_moves
 *   9. Atomically mark coupon redeemed (unique redeemedBySaleId)
 *  10. Append a single AuditLog entry summarising the discount
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

        // ── Coupon lookup (optional) ────────────────────────────────
        const couponCode = input.couponCode ?? null;
        const coupon = couponCode
          ? await tx.coupon.findUnique({ where: { code: couponCode } })
          : null;
        if (couponCode && !coupon) {
          throw new Error(`Coupon "${couponCode}" not found`);
        }
        if (coupon) {
          if (coupon.revokedAt) {
            throw new Error(`Coupon "${coupon.code}" has been revoked`);
          }
          if (coupon.redeemedAt || coupon.redeemedBySaleId) {
            throw new Error(`Coupon "${coupon.code}" has already been used`);
          }
          if (coupon.expiresAt < new Date()) {
            throw new Error(`Coupon "${coupon.code}" has expired`);
          }
          if (
            coupon.productId &&
            !input.items.some((i) => i.productId === coupon.productId)
          ) {
            const target = await tx.product.findUnique({
              where: { id: coupon.productId },
              select: { name: true },
            });
            throw new Error(
              `Coupon "${coupon.code}" only applies to ${target?.name ?? "a product not in this cart"}`,
            );
          }
        }

        // ── First pass: resolve every line's price + sealed/loose
        //    availability, so we know the gross subtotal needed to
        //    distribute a FIXED cart-wide coupon proportionally. We
        //    don't write anything yet.
        type LinePlan = {
          productId: string;
          unitsPerCarton: number;
          costPerCarton: number;
          minMarginBps: number;
          saleUnit: "UNIT" | "CARTON";
          qty: number;
          unitPrice: number;
          grossLineTotal: number;
          maxAllowedAtFloor: number;
        };
        const plans: LinePlan[] = [];
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
          const effectiveMarginBps =
            product.minMarginBps > 0
              ? product.minMarginBps
              : defaultMinMarginBps;
          const maxAllowedAtFloor = maxAllowedLineDiscount({
            saleUnit: item.saleUnit,
            qty: item.qty,
            unitPrice,
            costPerCarton: product.costPerCarton,
            unitsPerCarton: product.unitsPerCarton,
            marginBps: effectiveMarginBps,
          });
          plans.push({
            productId: product.id,
            unitsPerCarton: product.unitsPerCarton,
            costPerCarton: product.costPerCarton,
            minMarginBps: effectiveMarginBps,
            saleUnit: item.saleUnit,
            qty: item.qty,
            unitPrice,
            grossLineTotal,
            maxAllowedAtFloor,
          });
        }

        // ── Compute per-line discount from coupon (if any) ──────────
        const discountByIndex = new Array<number>(plans.length).fill(0);
        if (coupon) {
          if (coupon.type === "PERCENT") {
            // Apply percent to each eligible line independently.
            // value is whole percent (1..100). floor() so we never
            // round up against the merchant.
            for (let i = 0; i < plans.length; i++) {
              const plan = plans[i]!;
              if (coupon.productId && plan.productId !== coupon.productId)
                continue;
              discountByIndex[i] = Math.floor(
                (plan.grossLineTotal * coupon.value) / 100,
              );
            }
          } else {
            // FIXED
            const eligibleIdx = plans
              .map((_, i) => i)
              .filter(
                (i) =>
                  !coupon.productId ||
                  plans[i]!.productId === coupon.productId,
              );
            const eligibleGross = eligibleIdx.reduce(
              (a, i) => a + plans[i]!.grossLineTotal,
              0,
            );
            if (eligibleGross <= 0) {
              throw new Error(
                `Coupon "${coupon.code}" cannot be applied to a zero-value cart`,
              );
            }
            const target = Math.min(coupon.value, eligibleGross);
            if (eligibleIdx.length === 1) {
              discountByIndex[eligibleIdx[0]!] = target;
            } else {
              // Largest-remainder distribution. Each eligible line gets
              // floor(target * lineGross / sumGross); leftover RWF go to
              // the lines with the largest fractional part so the math
              // sums back to `target` exactly.
              const fracs: Array<{ i: number; frac: number }> = [];
              let assigned = 0;
              for (const i of eligibleIdx) {
                const exact =
                  (target * plans[i]!.grossLineTotal) / eligibleGross;
                const base = Math.floor(exact);
                discountByIndex[i] = base;
                assigned += base;
                fracs.push({ i, frac: exact - base });
              }
              let leftover = target - assigned;
              fracs.sort((a, b) => b.frac - a.frac);
              for (const { i } of fracs) {
                if (leftover <= 0) break;
                discountByIndex[i] = (discountByIndex[i] ?? 0) + 1;
                leftover -= 1;
              }
            }
          }

          // Floor enforcement. Skip when coupon was issued with
          // allowFloorOverride so the owner can deliberately authorize
          // a margin-breaking promotion.
          if (!coupon.allowFloorOverride) {
            for (let i = 0; i < plans.length; i++) {
              const plan = plans[i]!;
              const d = discountByIndex[i]!;
              if (d > plan.maxAllowedAtFloor) {
                const product = byId.get(plan.productId)!;
                if (plan.costPerCarton <= 0) {
                  throw new Error(
                    `${product.name}: set a purchase cost before this coupon can apply (no margin floor possible)`,
                  );
                }
                throw new Error(
                  `${product.name}: coupon "${coupon.code}" would breach the ${(plan.minMarginBps / 100).toFixed(1)}% margin floor (max RWF ${plan.maxAllowedAtFloor})`,
                );
              }
            }
          }
        }

        // ── Second pass: stock + carton handling, persist lines ─────
        let total = 0;
        type Persisted = {
          plan: LinePlan;
          discountAmount: number;
          lineTotal: number;
          cartonId: string | null;
        };
        const persisted: Persisted[] = [];

        for (let i = 0; i < plans.length; i++) {
          const plan = plans[i]!;
          const product = byId.get(plan.productId)!;
          const discountAmount = discountByIndex[i]!;
          if (discountAmount > plan.grossLineTotal) {
            throw new Error(
              `${product.name}: computed discount of RWF ${discountAmount} exceeds the line price of RWF ${plan.grossLineTotal}`,
            );
          }
          const lineTotal = plan.grossLineTotal - discountAmount;

          let cartonId: string | null = null;
          if (plan.saleUnit === "UNIT") {
            if (plan.qty > plan.unitsPerCarton) {
              throw new Error(
                `${product.name}: a UNIT sale can carry at most ${plan.unitsPerCarton} unit(s). Use a CARTON sale or split into smaller lines.`,
              );
            }
            const openedCarton = await tx.carton.findFirst({
              where: { productId: plan.productId, state: "OPENED" },
              orderBy: { openedAt: "asc" },
            });
            if (openedCarton && openedCarton.unitsRemaining >= plan.qty) {
              const willGoEmpty = openedCarton.unitsRemaining === plan.qty;
              await tx.carton.update({
                where: { id: openedCarton.id },
                data: {
                  unitsRemaining: { decrement: plan.qty },
                  ...(willGoEmpty
                    ? { state: "EMPTY", closedAt: new Date() }
                    : {}),
                },
              });
              cartonId = openedCarton.id;
            } else {
              const stockSum = await tx.stockMove.aggregate({
                where: { productId: plan.productId },
                _sum: { qtyUnits: true },
              });
              const totalUnits = stockSum._sum.qtyUnits ?? 0;
              const allOpened = await tx.carton.aggregate({
                where: { productId: plan.productId, state: "OPENED" },
                _sum: { unitsRemaining: true },
              });
              const openedUnits = allOpened._sum.unitsRemaining ?? 0;
              const sealedUnits = totalUnits - openedUnits;
              if (sealedUnits < plan.unitsPerCarton) {
                if (openedCarton) {
                  throw new Error(
                    `${product.name}: open carton has only ${openedCarton.unitsRemaining} unit(s) and no sealed cartons available.`,
                  );
                }
                throw new Error(`${product.name}: out of stock`);
              }
              const tag = `AUTO-${product.sku}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
              const willGoEmpty = plan.qty === plan.unitsPerCarton;
              const newCarton = await tx.carton.create({
                data: {
                  productId: plan.productId,
                  tag,
                  state: willGoEmpty ? "EMPTY" : "OPENED",
                  unitsRemaining: plan.unitsPerCarton - plan.qty,
                  openedByUserId: userId,
                  ...(willGoEmpty ? { closedAt: new Date() } : {}),
                },
              });
              await tx.stockMove.create({
                data: {
                  productId: plan.productId,
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
            const stockSum = await tx.stockMove.aggregate({
              where: { productId: plan.productId },
              _sum: { qtyUnits: true },
            });
            const totalUnits = stockSum._sum.qtyUnits ?? 0;
            const allOpened = await tx.carton.aggregate({
              where: { productId: plan.productId, state: "OPENED" },
              _sum: { unitsRemaining: true },
            });
            const openedUnits = allOpened._sum.unitsRemaining ?? 0;
            const sealedUnits = totalUnits - openedUnits;
            const requiredUnits = plan.qty * plan.unitsPerCarton;
            if (sealedUnits < requiredUnits) {
              const availableCartons = Math.floor(
                sealedUnits / plan.unitsPerCarton,
              );
              throw new Error(
                `${product.name}: only ${availableCartons} sealed carton(s) available`,
              );
            }
          }
          total += lineTotal;
          persisted.push({ plan, discountAmount, lineTotal, cartonId });
        }

        // Create the Sale row (with optional coupon link)
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
            couponId: coupon?.id ?? null,
          },
        });

        // SaleLines + stock_moves
        for (const p of persisted) {
          await tx.saleLine.create({
            data: {
              saleId: sale.id,
              productId: p.plan.productId,
              saleUnit: p.plan.saleUnit,
              qty: p.plan.qty,
              unitPrice: p.plan.unitPrice,
              discountAmount: p.discountAmount,
              discountReason: coupon
                ? `Coupon ${coupon.code}${coupon.notes ? ` — ${coupon.notes}` : ""}`
                : null,
              floorOverride:
                p.discountAmount > 0 && p.discountAmount > p.plan.maxAllowedAtFloor,
              lineTotal: p.lineTotal,
              cartonId: p.cartonId,
            },
          });
          const qtyUnitsDelta =
            p.plan.saleUnit === "UNIT"
              ? -p.plan.qty
              : -p.plan.qty * p.plan.unitsPerCarton;
          await tx.stockMove.create({
            data: {
              productId: p.plan.productId,
              qtyUnits: qtyUnitsDelta,
              reason: p.plan.saleUnit === "UNIT" ? "SALE_UNIT" : "SALE_CARTON",
              refType: "sale",
              refId: sale.id,
              userId,
            },
          });
        }

        // ── Atomically lock the coupon to this sale. The
        //    redeemedBySaleId @unique index means a second concurrent
        //    txn trying to use the same code will get a unique-key
        //    error here and roll back — making the one-time-use
        //    guarantee a DB constraint, not just app logic.
        if (coupon) {
          await tx.coupon.update({
            where: { id: coupon.id },
            data: {
              redeemedAt: new Date(),
              redeemedBySaleId: sale.id,
              redeemedByUserId: userId,
            },
          });
        }

        const discountTotal = persisted.reduce(
          (a, p) => a + p.discountAmount,
          0,
        );
        await tx.auditLog.create({
          data: {
            tableName: "sales",
            recordId: sale.id,
            action: "INSERT",
            category: coupon ? "SALE_DISCOUNT" : null,
            changes: {
              channelId: input.channelId,
              paymentMethod: input.paymentMethod,
              itemCount: input.items.length,
              total,
              ...(coupon
                ? {
                    couponId: coupon.id,
                    couponCode: coupon.code,
                    couponType: coupon.type,
                    couponValue: coupon.value,
                    discountTotal,
                    floorOverrideApplied: coupon.allowFloorOverride,
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
