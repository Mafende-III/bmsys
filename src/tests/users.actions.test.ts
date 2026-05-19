import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import {
  createUserOp,
  updateUserOp,
} from "@/lib/users/operations";
import {
  getAllowedChannelIds,
  userCanSellOnChannel,
} from "@/lib/permissions";

const prisma = new PrismaClient({
  datasourceUrl: process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL,
});

let ownerId: string;
let retailId: string;
let wholesaleId: string;
const TEST_USER_PHONE = "+250000999004";

// Full FK-safe wipe. We wipe ALL users to make the "last active OWNER"
// guard testable — only the test owner we re-create below exists.
const fullWipe = () =>
  prisma.$transaction([
    prisma.idempotencyKey.deleteMany({}),
    prisma.auditLog.deleteMany({}),
    prisma.userChannel.deleteMany({}),
    prisma.saleLine.deleteMany({}),
    prisma.sale.deleteMany({}),
    prisma.purchaseLine.deleteMany({}),
    prisma.purchase.deleteMany({}),
    prisma.adjustment.deleteMany({}),
    prisma.stockMove.deleteMany({}),
    prisma.carton.deleteMany({}),
    prisma.channelPriceOverride.deleteMany({}),
    prisma.product.deleteMany({}),
    prisma.supplier.deleteMany({}),
    prisma.customer.deleteMany({}),
    prisma.channel.deleteMany({}),
    prisma.user.deleteMany({}),
  ]);

beforeAll(fullWipe);

beforeEach(async () => {
  await fullWipe();

  const owner = await prisma.user.create({
    data: {
      name: "Owner Test",
      phone: TEST_USER_PHONE,
      pinHash: "x",
      role: "OWNER",
    },
  });
  ownerId = owner.id;

  const [retail, wholesale] = await Promise.all([
    prisma.channel.create({ data: { name: "Retail", slug: "retail" } }),
    prisma.channel.create({ data: { name: "Wholesale", slug: "wholesale" } }),
  ]);
  retailId = retail.id;
  wholesaleId = wholesale.id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("createUserOp", () => {
  it("creates a SELLER with the specified channels", async () => {
    const r = await createUserOp(ownerId, "uc-1", {
      name: "Jane Seller",
      phone: "+250000999100",
      pin: "1234",
      role: "SELLER",
      allowedChannelIds: [retailId],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const created = await prisma.user.findUniqueOrThrow({
      where: { id: r.data.id },
      include: { channels: true },
    });
    expect(created.role).toBe("SELLER");
    expect(created.active).toBe(true);
    expect(created.channels).toHaveLength(1);
    expect(created.channels[0]?.channelId).toBe(retailId);
    // PIN was hashed, not stored as plaintext
    expect(created.pinHash).not.toBe("1234");
    expect(created.pinHash.startsWith("$argon2")).toBe(true);
  });

  it("rejects when called by a SELLER", async () => {
    const sellerR = await prisma.user.create({
      data: {
        name: "Bad Caller",
        phone: "+250000999110",
        pinHash: "x",
        role: "SELLER",
      },
    });
    const r = await createUserOp(sellerR.id, "uc-2", {
      name: "Sneaky",
      phone: "+250000999111",
      pin: "1234",
      role: "OWNER",
      allowedChannelIds: [],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toMatch(/Only OWNER/i);
    }
  });

  it("rejects duplicate phone", async () => {
    await createUserOp(ownerId, "uc-3a", {
      name: "First",
      phone: "+250000999120",
      pin: "1234",
      role: "SELLER",
      allowedChannelIds: [],
    });
    const r = await createUserOp(ownerId, "uc-3b", {
      name: "Second",
      phone: "+250000999120",
      pin: "5678",
      role: "SELLER",
      allowedChannelIds: [],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toMatch(/Phone already in use/i);
    }
  });

  it("rejects unknown channel ids", async () => {
    const r = await createUserOp(ownerId, "uc-4", {
      name: "X",
      phone: "+250000999130",
      pin: "1234",
      role: "SELLER",
      allowedChannelIds: ["bogus"],
    });
    expect(r.ok).toBe(false);
  });
});

describe("updateUserOp", () => {
  it("changes role from SELLER to OWNER and drops channel rows", async () => {
    const create = await createUserOp(ownerId, "uu-1a", {
      name: "Becomes Owner",
      phone: "+250000999140",
      pin: "1234",
      role: "SELLER",
      allowedChannelIds: [retailId, wholesaleId],
    });
    expect(create.ok).toBe(true);
    if (!create.ok) return;

    const r = await updateUserOp(ownerId, "uu-1b", create.data.id, {
      name: "Becomes Owner",
      role: "OWNER",
      active: true,
      allowedChannelIds: [],
    });
    expect(r.ok).toBe(true);

    const after = await prisma.user.findUniqueOrThrow({
      where: { id: create.data.id },
      include: { channels: true },
    });
    expect(after.role).toBe("OWNER");
    expect(after.channels).toHaveLength(0);
  });

  it("reconciles channel list (swap retail for wholesale)", async () => {
    const create = await createUserOp(ownerId, "uu-2a", {
      name: "Swapper",
      phone: "+250000999150",
      pin: "1234",
      role: "SELLER",
      allowedChannelIds: [retailId],
    });
    expect(create.ok).toBe(true);
    if (!create.ok) return;

    const r = await updateUserOp(ownerId, "uu-2b", create.data.id, {
      name: "Swapper",
      role: "SELLER",
      active: true,
      allowedChannelIds: [wholesaleId],
    });
    expect(r.ok).toBe(true);

    const after = await prisma.user.findUniqueOrThrow({
      where: { id: create.data.id },
      include: { channels: true },
    });
    expect(after.channels).toHaveLength(1);
    expect(after.channels[0]?.channelId).toBe(wholesaleId);
  });

  it("hashes a new PIN when resetPin is provided", async () => {
    const create = await createUserOp(ownerId, "uu-3a", {
      name: "Reset Me",
      phone: "+250000999160",
      pin: "1234",
      role: "SELLER",
      allowedChannelIds: [retailId],
    });
    expect(create.ok).toBe(true);
    if (!create.ok) return;

    const before = await prisma.user.findUniqueOrThrow({
      where: { id: create.data.id },
    });

    const r = await updateUserOp(ownerId, "uu-3b", create.data.id, {
      name: "Reset Me",
      role: "SELLER",
      active: true,
      allowedChannelIds: [retailId],
      resetPin: "9999",
    });
    expect(r.ok).toBe(true);

    const after = await prisma.user.findUniqueOrThrow({
      where: { id: create.data.id },
    });
    expect(after.pinHash).not.toBe(before.pinHash);
    expect(after.pinHash.startsWith("$argon2")).toBe(true);
  });

  it("refuses to demote the last active OWNER", async () => {
    const r = await updateUserOp(ownerId, "uu-4", ownerId, {
      name: "Owner Test",
      role: "SELLER",
      active: true,
      allowedChannelIds: [retailId],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toMatch(/last active OWNER/i);
    }
  });

  it("refuses to deactivate the last active OWNER", async () => {
    const r = await updateUserOp(ownerId, "uu-5", ownerId, {
      name: "Owner Test",
      role: "OWNER",
      active: false,
      allowedChannelIds: [],
    });
    expect(r.ok).toBe(false);
  });
});

describe("permissions", () => {
  it("OWNER is allowed on every channel (ALL sentinel)", async () => {
    const allowed = await getAllowedChannelIds(ownerId);
    expect(allowed).toBe("ALL");

    expect(await userCanSellOnChannel(ownerId, retailId)).toBe(true);
    expect(await userCanSellOnChannel(ownerId, wholesaleId)).toBe(true);
  });

  it("SELLER is allowed only on assigned channels", async () => {
    const create = await createUserOp(ownerId, "perm-1", {
      name: "Only Retail",
      phone: "+250000999170",
      pin: "1234",
      role: "SELLER",
      allowedChannelIds: [retailId],
    });
    expect(create.ok).toBe(true);
    if (!create.ok) return;

    expect(await userCanSellOnChannel(create.data.id, retailId)).toBe(true);
    expect(await userCanSellOnChannel(create.data.id, wholesaleId)).toBe(
      false,
    );
  });

  it("deactivated user is allowed on no channel", async () => {
    const create = await createUserOp(ownerId, "perm-2a", {
      name: "Disabled",
      phone: "+250000999180",
      pin: "1234",
      role: "SELLER",
      allowedChannelIds: [retailId],
    });
    expect(create.ok).toBe(true);
    if (!create.ok) return;

    await updateUserOp(ownerId, "perm-2b", create.data.id, {
      name: "Disabled",
      role: "SELLER",
      active: false,
      allowedChannelIds: [retailId],
    });

    expect(await userCanSellOnChannel(create.data.id, retailId)).toBe(false);
  });
});
