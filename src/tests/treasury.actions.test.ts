import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import {
  closeSessionOp,
  openSessionOp,
} from "@/lib/cash-sessions/operations";
import {
  recordCashTransferOp,
  setCheckpointsOp,
} from "@/lib/treasury/operations";

const prisma = new PrismaClient({
  datasourceUrl: process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL,
});

let ownerId: string;
let sellerId: string;
const OWNER_PHONE = "+250000999060";
const SELLER_PHONE = "+250000999061";

const fullWipe = () =>
  prisma.$transaction([
    prisma.idempotencyKey.deleteMany({}),
    prisma.auditLog.deleteMany({}),
    prisma.cashTransfer.deleteMany({}),
    prisma.cashSession.deleteMany({}),
    prisma.saleLine.deleteMany({}),
    prisma.sale.deleteMany({}),
    prisma.expense.deleteMany({}),
    prisma.settings.deleteMany({}),
    prisma.user.deleteMany({
      where: { phone: { in: [OWNER_PHONE, SELLER_PHONE] } },
    }),
  ]);

beforeAll(fullWipe);

beforeEach(async () => {
  await fullWipe();
  const owner = await prisma.user.create({
    data: {
      name: "Treasury Owner",
      phone: OWNER_PHONE,
      pinHash: "x",
      role: "OWNER",
    },
  });
  ownerId = owner.id;
  const seller = await prisma.user.create({
    data: {
      name: "Treasury Seller",
      phone: SELLER_PHONE,
      pinHash: "x",
      role: "SELLER",
    },
  });
  sellerId = seller.id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("recordCashTransferOp", () => {
  it("owner records a transfer; audit row written", async () => {
    const r = await recordCashTransferOp(ownerId, {
      amount: 50000,
      toMethod: "MOMO",
      reference: "AGT-123",
    });
    expect(r.ok).toBe(true);

    const transfers = await prisma.cashTransfer.findMany({});
    expect(transfers).toHaveLength(1);
    expect(transfers[0]?.amount).toBe(50000);
    expect(transfers[0]?.toMethod).toBe("MOMO");

    const audits = await prisma.auditLog.findMany({
      where: { tableName: "CashTransfer" },
    });
    expect(audits).toHaveLength(1);
  });

  it("seller cannot record transfers", async () => {
    const r = await recordCashTransferOp(sellerId, {
      amount: 1000,
      toMethod: "MOMO",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/owner/i);
    expect(await prisma.cashTransfer.count()).toBe(0);
  });

  it("rejects zero or negative amounts", async () => {
    const r = await recordCashTransferOp(ownerId, {
      amount: 0,
      toMethod: "BANK",
    });
    expect(r.ok).toBe(false);
  });
});

describe("till close with transfers", () => {
  it("expectedCash subtracts transfers made during the session", async () => {
    const open = await openSessionOp(ownerId, "tt-open-1", {
      openingFloat: 10000,
    });
    expect(open.ok).toBe(true);
    if (!open.ok) return;

    // Owner deposits 6,000 of drawer cash to MoMo mid-session.
    const t = await recordCashTransferOp(ownerId, {
      amount: 6000,
      toMethod: "MOMO",
    });
    expect(t.ok).toBe(true);

    // Close with exactly what should be left: 10,000 − 6,000 = 4,000.
    const close = await closeSessionOp(ownerId, "tt-close-1", open.data.id, {
      closingCount: 4000,
    });
    expect(close.ok).toBe(true);
    if (!close.ok) return;
    expect(close.data.expectedCash).toBe(4000);
    expect(close.data.variance).toBe(0);
  });
});

describe("setCheckpointsOp", () => {
  it("sets MoMo checkpoint with timestamp; bank untouched", async () => {
    const r = await setCheckpointsOp(ownerId, { momoBalance: 733700 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.updated).toEqual(["MOMO"]);

    const s = await prisma.settings.findUnique({ where: { id: "default" } });
    expect(s?.momoOpeningBalance).toBe(733700);
    expect(s?.momoCheckpointAt).toBeTruthy();
    expect(s?.bankCheckpointAt).toBeNull();
  });

  it("seller cannot set checkpoints", async () => {
    const r = await setCheckpointsOp(sellerId, { momoBalance: 1 });
    expect(r.ok).toBe(false);
  });

  it("rejects an empty update", async () => {
    const r = await setCheckpointsOp(ownerId, {});
    expect(r.ok).toBe(false);
  });
});
