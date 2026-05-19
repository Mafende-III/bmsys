import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { upsertPriceOverridesOp } from "@/lib/channel-prices/operations";

const prisma = new PrismaClient({
  datasourceUrl: process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL,
});

let userId: string;
let productId: string;
let retailChannelId: string;
let wholesaleChannelId: string;
const TEST_USER_PHONE = "+250000999003";

beforeAll(async () => {
  await prisma.$transaction([
    prisma.idempotencyKey.deleteMany({}),
    prisma.auditLog.deleteMany({}),
    prisma.saleLine.deleteMany({}),
    prisma.sale.deleteMany({}),
    prisma.purchaseLine.deleteMany({}),
    prisma.purchase.deleteMany({}),
    prisma.adjustment.deleteMany({}),
    prisma.stockMove.deleteMany({}),
    prisma.carton.deleteMany({}),
    prisma.channelPriceOverride.deleteMany({}),
    prisma.product.deleteMany({}),
    prisma.customer.deleteMany({}),
    prisma.channel.deleteMany({}),
    prisma.user.deleteMany({ where: { phone: TEST_USER_PHONE } }),
  ]);

  const u = await prisma.user.create({
    data: {
      name: "Channel Prices Test Runner",
      phone: TEST_USER_PHONE,
      pinHash: "x",
      role: "OWNER",
    },
  });
  userId = u.id;
});

beforeEach(async () => {
  await prisma.$transaction([
    prisma.idempotencyKey.deleteMany({}),
    prisma.auditLog.deleteMany({}),
    prisma.channelPriceOverride.deleteMany({}),
    prisma.product.deleteMany({}),
    prisma.channel.deleteMany({}),
  ]);

  const [retail, wholesale, product] = await Promise.all([
    prisma.channel.create({ data: { name: "Retail", slug: "retail" } }),
    prisma.channel.create({ data: { name: "Wholesale", slug: "wholesale" } }),
    prisma.product.create({
      data: {
        sku: "TEST-PROD-PRICE",
        name: "Test Product",
        unitsPerCarton: 12,
        costPerCarton: 4500,
        unitPrice: 600,
        cartonPrice: 6800,
      },
    }),
  ]);

  retailChannelId = retail.id;
  wholesaleChannelId = wholesale.id;
  productId = product.id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("upsertPriceOverridesOp", () => {
  it("creates an override and writes an INSERT audit row", async () => {
    const result = await upsertPriceOverridesOp(userId, "cp-1", {
      productId,
      overrides: [
        {
          channelId: wholesaleChannelId,
          unitPrice: 500,
          cartonPrice: 6000,
        },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.changed).toBe(1);

    const rows = await prisma.channelPriceOverride.findMany({
      where: { productId },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.unitPrice).toBe(500);
    expect(rows[0]?.cartonPrice).toBe(6000);

    const audits = await prisma.auditLog.findMany({
      where: { tableName: "channel_price_overrides", action: "INSERT" },
    });
    expect(audits).toHaveLength(1);
  });

  it("deletes the row when both prices are blank", async () => {
    await prisma.channelPriceOverride.create({
      data: {
        productId,
        channelId: wholesaleChannelId,
        unitPrice: 500,
        cartonPrice: 6000,
      },
    });

    const result = await upsertPriceOverridesOp(userId, "cp-2", {
      productId,
      overrides: [
        {
          channelId: wholesaleChannelId,
          unitPrice: null,
          cartonPrice: null,
        },
      ],
    });
    expect(result.ok).toBe(true);

    const rows = await prisma.channelPriceOverride.findMany({
      where: { productId },
    });
    expect(rows).toHaveLength(0);

    const audits = await prisma.auditLog.findMany({
      where: { tableName: "channel_price_overrides", action: "DELETE" },
    });
    expect(audits).toHaveLength(1);
  });

  it("updates only the changed field (sparse: unit override only, no carton)", async () => {
    const result = await upsertPriceOverridesOp(userId, "cp-3", {
      productId,
      overrides: [
        {
          channelId: retailChannelId,
          unitPrice: 650,
          cartonPrice: null,
        },
      ],
    });
    expect(result.ok).toBe(true);

    const rows = await prisma.channelPriceOverride.findMany({
      where: { productId, channelId: retailChannelId },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.unitPrice).toBe(650);
    expect(rows[0]?.cartonPrice).toBeNull();
  });

  it("does not touch unchanged rows (changed count = 0)", async () => {
    await upsertPriceOverridesOp(userId, "cp-4a", {
      productId,
      overrides: [
        {
          channelId: wholesaleChannelId,
          unitPrice: 500,
          cartonPrice: 6000,
        },
      ],
    });

    const result = await upsertPriceOverridesOp(userId, "cp-4b", {
      productId,
      overrides: [
        {
          channelId: wholesaleChannelId,
          unitPrice: 500,
          cartonPrice: 6000,
        },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.changed).toBe(0);
  });

  it("handles multiple channels in a single call", async () => {
    const result = await upsertPriceOverridesOp(userId, "cp-5", {
      productId,
      overrides: [
        {
          channelId: retailChannelId,
          unitPrice: null,
          cartonPrice: null,
        },
        {
          channelId: wholesaleChannelId,
          unitPrice: 500,
          cartonPrice: 6000,
        },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.changed).toBe(1); // retail had nothing to delete; wholesale was inserted

    const rows = await prisma.channelPriceOverride.findMany({
      where: { productId },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.channelId).toBe(wholesaleChannelId);
  });

  it("refuses to edit prices for an archived product", async () => {
    await prisma.product.update({
      where: { id: productId },
      data: { active: false },
    });

    const result = await upsertPriceOverridesOp(userId, "cp-6", {
      productId,
      overrides: [
        {
          channelId: wholesaleChannelId,
          unitPrice: 500,
          cartonPrice: 6000,
        },
      ],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/archived/i);
    }
  });

  it("rejects an unknown channel id", async () => {
    const result = await upsertPriceOverridesOp(userId, "cp-7", {
      productId,
      overrides: [
        {
          channelId: "definitely-not-a-channel",
          unitPrice: 500,
          cartonPrice: 6000,
        },
      ],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/Unknown channel/i);
    }
  });

  it("returns the cached result on idempotent reuse", async () => {
    const input = {
      productId,
      overrides: [
        {
          channelId: wholesaleChannelId,
          unitPrice: 500,
          cartonPrice: 6000,
        },
      ],
    };
    const r1 = await upsertPriceOverridesOp(userId, "cp-8", input);
    expect(r1.ok).toBe(true);
    const r2 = await upsertPriceOverridesOp(userId, "cp-8", input);
    expect(r2.ok).toBe(true);

    // Still only one row in the table — the second call didn't double-insert.
    const rows = await prisma.channelPriceOverride.findMany({
      where: { productId },
    });
    expect(rows).toHaveLength(1);
  });
});
