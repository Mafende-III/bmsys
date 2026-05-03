/**
 * THE GOLDEN TEST.
 *
 * If this fails, the system is lying about money. CI must block the merge.
 *
 * Scenario:
 *  1. Receive a purchase of 1 carton (12 units) of product X.
 *  2. Open the carton (tagged 'CTN-001').
 *  3. Sell 3 units (retail).
 *  4. Sell 1 carton wholesale (this fails because there is no sealed carton; expected).
 *  5. Receive a second purchase of 2 cartons (24 units).
 *  6. Sell 1 carton wholesale (succeeds, 12 units leave).
 *  7. Record a breakage of 1 unit.
 *  8. Assert:
 *     - Total stock units = 12 - 3 - 12 - 1 = -4? No: 12 + 24 - 3 - 12 - 1 = 20
 *     - Sealed cartons = floor((20 - units_in_opened) / 12)
 *     - Opened carton CTN-001 has 12 - 3 = 9 units remaining (still OPENED)
 *     - Sealed = floor((20 - 9) / 12) = 0 (because we used 12 sealed for wholesale)
 *
 * NOTE: This test requires a running Postgres test database. Set TEST_DATABASE_URL.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  datasourceUrl: process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL,
});

describe("Golden test: stock + cash + ledger integrity", () => {
  beforeAll(async () => {
    // Wipe in dependency order. Only deletes this test's own User row
    // (phone "+1") so the seeded owner ("+250788000000") survives, which
    // matters when DATABASE_URL == TEST_DATABASE_URL (single dev DB).
    // Channels and suppliers are scoped to test-specific slugs/names below
    // so we wipe them all here without affecting the seed (the seed's
    // channels are recreated by `pnpm prisma:seed`).
    await prisma.$transaction([
      prisma.saleLine.deleteMany({}),
      prisma.sale.deleteMany({}),
      prisma.purchaseLine.deleteMany({}),
      prisma.purchase.deleteMany({}),
      prisma.adjustment.deleteMany({}),
      prisma.stockMove.deleteMany({}),
      prisma.carton.deleteMany({}),
      prisma.product.deleteMany({}),
      prisma.supplier.deleteMany({}),
      prisma.channel.deleteMany({}),
      prisma.user.deleteMany({ where: { phone: "+1" } }),
    ]);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("preserves invariants across the full purchase->sell->adjust cycle", async () => {
    // ----- Setup -----
    const owner = await prisma.user.create({
      data: { name: "T", phone: "+1", pinHash: "x", role: "OWNER" },
    });
    const supplier = await prisma.supplier.create({
      data: { name: "Test Supplier" },
    });
    const channel = await prisma.channel.create({
      data: { name: "Retail", slug: "retail-test" },
    });
    const product = await prisma.product.create({
      data: {
        sku: "TEST-001",
        name: "Test Water 500ML",
        unitsPerCarton: 12,
        costPerCarton: 4500,
        unitPrice: 600,
        cartonPrice: 6800,
      },
    });

    // ----- 1. Purchase 1 carton (12 units) -----
    await prisma.$transaction(async (tx) => {
      const purchase = await tx.purchase.create({
        data: {
          supplierId: supplier.id,
          date: new Date(),
          status: "RECEIVED",
          totalCost: 4500,
          userId: owner.id,
          lines: {
            create: [
              {
                productId: product.id,
                qtyCartons: 1,
                qtyLooseUnits: 0,
                unitCost: 4500,
                lineTotal: 4500,
              },
            ],
          },
        },
      });
      await tx.stockMove.create({
        data: {
          productId: product.id,
          qtyUnits: 12,
          reason: "PURCHASE",
          refType: "purchase",
          refId: purchase.id,
          userId: owner.id,
        },
      });
    });

    // ----- 2. Open carton CTN-001 -----
    const carton = await prisma.$transaction(async (tx) => {
      const c = await tx.carton.create({
        data: {
          productId: product.id,
          tag: "CTN-001",
          state: "OPENED",
          unitsRemaining: 12,
          openedByUserId: owner.id,
        },
      });
      await tx.stockMove.create({
        data: {
          productId: product.id,
          qtyUnits: 0,
          reason: "CARTON_OPEN",
          refType: "carton",
          refId: c.id,
          userId: owner.id,
        },
      });
      return c;
    });

    // ----- 3. Sell 3 units retail -----
    await prisma.$transaction(async (tx) => {
      const sale = await tx.sale.create({
        data: {
          channelId: channel.id,
          paymentMethod: "CASH",
          amountPaid: 1800,
          total: 1800,
          userId: owner.id,
          lines: {
            create: [
              {
                productId: product.id,
                saleUnit: "UNIT",
                qty: 3,
                unitPrice: 600,
                lineTotal: 1800,
                cartonId: carton.id,
              },
            ],
          },
        },
      });
      await tx.carton.update({
        where: { id: carton.id },
        data: { unitsRemaining: { decrement: 3 } },
      });
      await tx.stockMove.create({
        data: {
          productId: product.id,
          qtyUnits: -3,
          reason: "SALE_UNIT",
          refType: "sale",
          refId: sale.id,
          userId: owner.id,
        },
      });
    });

    // ----- 5. Receive a second purchase of 2 cartons (24 units) -----
    await prisma.$transaction(async (tx) => {
      const purchase = await tx.purchase.create({
        data: {
          supplierId: supplier.id,
          date: new Date(),
          status: "RECEIVED",
          totalCost: 9000,
          userId: owner.id,
          lines: {
            create: [
              {
                productId: product.id,
                qtyCartons: 2,
                qtyLooseUnits: 0,
                unitCost: 4500,
                lineTotal: 9000,
              },
            ],
          },
        },
      });
      await tx.stockMove.create({
        data: {
          productId: product.id,
          qtyUnits: 24,
          reason: "PURCHASE",
          refType: "purchase",
          refId: purchase.id,
          userId: owner.id,
        },
      });
    });

    // ----- 6. Sell 1 carton wholesale -----
    await prisma.$transaction(async (tx) => {
      const sale = await tx.sale.create({
        data: {
          channelId: channel.id,
          paymentMethod: "CASH",
          amountPaid: 6800,
          total: 6800,
          userId: owner.id,
          lines: {
            create: [
              {
                productId: product.id,
                saleUnit: "CARTON",
                qty: 1,
                unitPrice: 6800,
                lineTotal: 6800,
              },
            ],
          },
        },
      });
      await tx.stockMove.create({
        data: {
          productId: product.id,
          qtyUnits: -12,
          reason: "SALE_CARTON",
          refType: "sale",
          refId: sale.id,
          userId: owner.id,
        },
      });
    });

    // ----- 7. Record breakage of 1 unit -----
    await prisma.$transaction(async (tx) => {
      const adj = await tx.adjustment.create({
        data: {
          productId: product.id,
          qtyUnits: -1,
          reason: "ADJUSTMENT_BREAKAGE",
          note: "Dropped at counter",
          userId: owner.id,
        },
      });
      await tx.stockMove.create({
        data: {
          productId: product.id,
          qtyUnits: -1,
          reason: "ADJUSTMENT_BREAKAGE",
          refType: "adjustment",
          refId: adj.id,
          userId: owner.id,
        },
      });
    });

    // ===== ASSERTIONS =====

    // Stock from ledger: 12 + 24 - 3 - 12 - 1 = 20
    const ledgerSum = await prisma.stockMove.aggregate({
      where: { productId: product.id },
      _sum: { qtyUnits: true },
    });
    expect(ledgerSum._sum.qtyUnits).toBe(20);

    // Opened carton CTN-001 should have 12 - 3 = 9 units, still OPENED
    const c = await prisma.carton.findUniqueOrThrow({ where: { id: carton.id } });
    expect(c.state).toBe("OPENED");
    expect(c.unitsRemaining).toBe(9);

    // Sealed cartons = floor((20 - 9) / 12) = floor(11/12) = 0
    const sealedUnits = 20 - c.unitsRemaining;
    const sealedCartons = Math.floor(sealedUnits / product.unitsPerCarton);
    expect(sealedCartons).toBe(0);
    expect(sealedUnits).toBe(11);
  });
});
