import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import {
  createChannelOp,
  deactivateChannelOp,
  reactivateChannelOp,
  updateChannelOp,
} from "@/lib/channels/operations";

const prisma = new PrismaClient({
  datasourceUrl: process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL,
});

let userId: string;
const TEST_USER_PHONE = "+250000999002";

beforeAll(async () => {
  await prisma.$transaction([
    prisma.idempotencyKey.deleteMany({}),
    prisma.auditLog.deleteMany({}),
    prisma.saleLine.deleteMany({}),
    prisma.sale.deleteMany({}),
    prisma.customer.deleteMany({}),
    prisma.channelPriceOverride.deleteMany({}),
    prisma.channel.deleteMany({}),
    prisma.user.deleteMany({ where: { phone: TEST_USER_PHONE } }),
  ]);

  const u = await prisma.user.create({
    data: {
      name: "Channels Test Runner",
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
    prisma.auditLog.deleteMany({ where: { tableName: "channels" } }),
    prisma.saleLine.deleteMany({}),
    prisma.sale.deleteMany({}),
    prisma.customer.deleteMany({}),
    prisma.channelPriceOverride.deleteMany({}),
    prisma.channel.deleteMany({}),
  ]);
});

afterAll(async () => {
  await prisma.$disconnect();
});

const validInput = { name: "Retail", slug: "retail" };

describe("createChannelOp", () => {
  it("creates a channel and writes an INSERT audit row", async () => {
    const result = await createChannelOp(userId, "ch-create-1", validInput);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const created = await prisma.channel.findUnique({
      where: { id: result.data.id },
    });
    expect(created?.slug).toBe("retail");
    expect(created?.active).toBe(true);

    const audits = await prisma.auditLog.findMany({
      where: {
        tableName: "channels",
        recordId: result.data.id,
        action: "INSERT",
      },
    });
    expect(audits).toHaveLength(1);
  });

  it("rejects duplicate slug", async () => {
    const r1 = await createChannelOp(userId, "ch-create-2a", validInput);
    expect(r1.ok).toBe(true);

    const r2 = await createChannelOp(userId, "ch-create-2b", validInput);
    expect(r2.ok).toBe(false);
    if (!r2.ok) {
      expect(r2.error).toMatch(/Slug already in use/i);
    }
  });

  it("returns the cached result on idempotent reuse", async () => {
    const r1 = await createChannelOp(userId, "ch-create-3", validInput);
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;

    const r2 = await createChannelOp(userId, "ch-create-3", validInput);
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;

    expect(r2.data.id).toBe(r1.data.id);
    expect(await prisma.channel.count()).toBe(1);
  });

  it("rejects bad slug via Zod", async () => {
    const r = await createChannelOp(userId, "ch-create-4", {
      name: "Bad",
      slug: "BAD SLUG",
    });
    expect(r.ok).toBe(false);
  });
});

describe("updateChannelOp", () => {
  it("renames a channel and writes an UPDATE audit row", async () => {
    const created = await createChannelOp(userId, "ch-upd-1a", validInput);
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const r = await updateChannelOp(userId, "ch-upd-1b", created.data.id, {
      name: "Retail (renamed)",
    });
    expect(r.ok).toBe(true);

    const after = await prisma.channel.findUniqueOrThrow({
      where: { id: created.data.id },
    });
    expect(after.name).toBe("Retail (renamed)");
    expect(after.slug).toBe("retail"); // slug never changed

    const audits = await prisma.auditLog.findMany({
      where: {
        tableName: "channels",
        recordId: created.data.id,
        action: "UPDATE",
      },
    });
    expect(audits.length).toBeGreaterThanOrEqual(1);
  });
});

describe("deactivateChannelOp", () => {
  it("deactivates a channel with no recent sales", async () => {
    const created = await createChannelOp(userId, "ch-deact-1a", validInput);
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const r = await deactivateChannelOp(userId, "ch-deact-1b", created.data.id);
    expect(r.ok).toBe(true);

    const after = await prisma.channel.findUniqueOrThrow({
      where: { id: created.data.id },
    });
    expect(after.active).toBe(false);
  });

  it("refuses to deactivate when there are sales in the last 30 days", async () => {
    const created = await createChannelOp(userId, "ch-deact-2a", validInput);
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    // Insert a sale today on this channel.
    await prisma.sale.create({
      data: {
        channelId: created.data.id,
        paymentMethod: "CASH",
        total: 1000,
        amountPaid: 1000,
        userId,
      },
    });

    const r = await deactivateChannelOp(userId, "ch-deact-2b", created.data.id);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toMatch(/sale.*30 days/i);
    }

    const after = await prisma.channel.findUniqueOrThrow({
      where: { id: created.data.id },
    });
    expect(after.active).toBe(true);
  });

  it("allows deactivate when the only sale is older than 30 days", async () => {
    const created = await createChannelOp(userId, "ch-deact-3a", validInput);
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const longAgo = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
    await prisma.sale.create({
      data: {
        channelId: created.data.id,
        paymentMethod: "CASH",
        total: 1000,
        amountPaid: 1000,
        userId,
        date: longAgo,
      },
    });

    const r = await deactivateChannelOp(userId, "ch-deact-3b", created.data.id);
    expect(r.ok).toBe(true);
  });

  it("is a no-op when already inactive", async () => {
    const created = await createChannelOp(userId, "ch-deact-4a", validInput);
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const r1 = await deactivateChannelOp(userId, "ch-deact-4b", created.data.id);
    expect(r1.ok).toBe(true);
    const r2 = await deactivateChannelOp(userId, "ch-deact-4c", created.data.id);
    expect(r2.ok).toBe(true);

    const after = await prisma.channel.findUniqueOrThrow({
      where: { id: created.data.id },
    });
    expect(after.active).toBe(false);
  });
});

describe("reactivateChannelOp", () => {
  it("reactivates a previously-deactivated channel", async () => {
    const created = await createChannelOp(userId, "ch-react-1a", validInput);
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const d = await deactivateChannelOp(userId, "ch-react-1b", created.data.id);
    expect(d.ok).toBe(true);

    const r = await reactivateChannelOp(userId, "ch-react-1c", created.data.id);
    expect(r.ok).toBe(true);

    const after = await prisma.channel.findUniqueOrThrow({
      where: { id: created.data.id },
    });
    expect(after.active).toBe(true);
  });
});
