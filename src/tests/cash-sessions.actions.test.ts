import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import {
  closeSessionOp,
  openSessionOp,
} from "@/lib/cash-sessions/operations";

const prisma = new PrismaClient({
  datasourceUrl: process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL,
});

let userId: string;
let channelId: string;
const TEST_USER_PHONE = "+250000999009";

const fullWipe = () =>
  prisma.$transaction([
    prisma.idempotencyKey.deleteMany({}),
    prisma.auditLog.deleteMany({}),
    prisma.cashSession.deleteMany({}),
    prisma.saleLine.deleteMany({}),
    prisma.sale.deleteMany({}),
    prisma.customer.deleteMany({}),
    prisma.channelPriceOverride.deleteMany({}),
    prisma.channel.deleteMany({}),
    prisma.user.deleteMany({ where: { phone: TEST_USER_PHONE } }),
  ]);

beforeAll(fullWipe);

beforeEach(async () => {
  await fullWipe();
  const u = await prisma.user.create({
    data: {
      name: "Cash Test",
      phone: TEST_USER_PHONE,
      pinHash: "x",
      role: "OWNER",
    },
  });
  userId = u.id;
  const c = await prisma.channel.create({
    data: { name: "Retail", slug: "retail" },
  });
  channelId = c.id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("openSessionOp", () => {
  it("creates an OPEN session and writes an audit log", async () => {
    const r = await openSessionOp(userId, "cs-1", {
      openingFloat: 50000,
      note: "morning",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const s = await prisma.cashSession.findUniqueOrThrow({
      where: { id: r.data.id },
    });
    expect(s.openingFloat).toBe(50000);
    expect(s.closedAt).toBeNull();

    const audits = await prisma.auditLog.findMany({
      where: {
        tableName: "cash_sessions",
        recordId: r.data.id,
        action: "INSERT",
      },
    });
    expect(audits).toHaveLength(1);
  });

  it("refuses to open if another session is already open", async () => {
    const r1 = await openSessionOp(userId, "cs-2a", { openingFloat: 10000 });
    expect(r1.ok).toBe(true);

    const r2 = await openSessionOp(userId, "cs-2b", { openingFloat: 20000 });
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.error).toMatch(/already open/i);
  });

  it("allows opening a fresh session after the previous one is closed", async () => {
    const r1 = await openSessionOp(userId, "cs-3a", { openingFloat: 10000 });
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;

    const close = await closeSessionOp(userId, "cs-3b", r1.data.id, {
      closingCount: 10000,
    });
    expect(close.ok).toBe(true);

    const r2 = await openSessionOp(userId, "cs-3c", { openingFloat: 5000 });
    expect(r2.ok).toBe(true);
  });
});

describe("closeSessionOp", () => {
  it("computes expectedCash = openingFloat + cash sales", async () => {
    const open = await openSessionOp(userId, "cs-4a", { openingFloat: 10000 });
    expect(open.ok).toBe(true);
    if (!open.ok) return;

    // Insert a CASH sale on this session's date
    await prisma.sale.create({
      data: {
        channelId,
        paymentMethod: "CASH",
        total: 2000,
        amountPaid: 2000,
        userId,
      },
    });

    const r = await closeSessionOp(userId, "cs-4b", open.data.id, {
      closingCount: 12000,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.expectedCash).toBe(12000); // 10000 + 2000
    expect(r.data.variance).toBe(0);
  });

  it("reports negative variance when cash is short", async () => {
    const open = await openSessionOp(userId, "cs-5a", { openingFloat: 10000 });
    expect(open.ok).toBe(true);
    if (!open.ok) return;

    await prisma.sale.create({
      data: {
        channelId,
        paymentMethod: "CASH",
        total: 5000,
        amountPaid: 5000,
        userId,
      },
    });

    const r = await closeSessionOp(userId, "cs-5b", open.data.id, {
      closingCount: 14000,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.expectedCash).toBe(15000);
    expect(r.data.variance).toBe(-1000);
  });

  it("ignores non-CASH sales", async () => {
    const open = await openSessionOp(userId, "cs-6a", { openingFloat: 0 });
    expect(open.ok).toBe(true);
    if (!open.ok) return;

    await prisma.sale.create({
      data: {
        channelId,
        paymentMethod: "MOMO",
        total: 50000,
        amountPaid: 50000,
        userId,
      },
    });

    const r = await closeSessionOp(userId, "cs-6b", open.data.id, {
      closingCount: 0,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.expectedCash).toBe(0);
    expect(r.data.variance).toBe(0);
  });

  it("refuses to close an already-closed session", async () => {
    const open = await openSessionOp(userId, "cs-7a", { openingFloat: 10000 });
    expect(open.ok).toBe(true);
    if (!open.ok) return;

    const r1 = await closeSessionOp(userId, "cs-7b", open.data.id, {
      closingCount: 10000,
    });
    expect(r1.ok).toBe(true);

    const r2 = await closeSessionOp(userId, "cs-7c", open.data.id, {
      closingCount: 10000,
    });
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.error).toMatch(/already closed/i);
  });
});
