import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import {
  createExpenseOp,
  runDueRecurringOp,
  upsertRecurringOp,
} from "@/lib/expenses/operations";

const prisma = new PrismaClient({
  datasourceUrl: process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL,
});

let userId: string;
let categoryId: string;
let supplierId: string;
const TEST_USER_PHONE = "+250000999011";

const fullWipe = () =>
  prisma.$transaction([
    prisma.idempotencyKey.deleteMany({}),
    prisma.auditLog.deleteMany({}),
    prisma.cashSession.deleteMany({}),
    prisma.expense.deleteMany({}),
    prisma.recurringExpense.deleteMany({}),
    prisma.supplier.deleteMany({}),
    prisma.user.deleteMany({ where: { phone: TEST_USER_PHONE } }),
  ]);

beforeAll(fullWipe);

beforeEach(async () => {
  await fullWipe();

  const user = await prisma.user.create({
    data: {
      name: "Exp Test",
      phone: TEST_USER_PHONE,
      pinHash: "x",
      role: "OWNER",
    },
  });
  userId = user.id;

  // Use any existing seeded category (or create one in test DB).
  const cat = await prisma.expenseCategory.upsert({
    where: { slug: "rent" },
    update: {},
    create: { name: "Rent", slug: "rent" },
  });
  categoryId = cat.id;

  const sup = await prisma.supplier.create({ data: { name: "Test Vendor" } });
  supplierId = sup.id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("createExpenseOp", () => {
  it("creates a non-CASH expense without needing a cash session", async () => {
    const r = await createExpenseOp(userId, "e-1", {
      date: new Date(),
      amount: 150000,
      categoryId,
      description: "November rent",
      paymentMethod: "BANK",
      paymentReference: "TXN-2025-11",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const exp = await prisma.expense.findUniqueOrThrow({
      where: { id: r.data.id },
    });
    expect(exp.amount).toBe(150000);
    expect(exp.paymentMethod).toBe("BANK");
  });

  it("refuses a CASH expense when the till is closed", async () => {
    const r = await createExpenseOp(userId, "e-2", {
      date: new Date(),
      amount: 5000,
      categoryId,
      description: "Petrol",
      paymentMethod: "CASH",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/Till is closed/i);
  });

  it("allows a CASH expense when a session is open", async () => {
    await prisma.cashSession.create({
      data: { openingFloat: 50000, openedById: userId },
    });
    const r = await createExpenseOp(userId, "e-3", {
      date: new Date(),
      amount: 5000,
      categoryId,
      description: "Petrol",
      paymentMethod: "CASH",
    });
    expect(r.ok).toBe(true);
  });

  it("rejects empty description and zero amount", async () => {
    const a = await createExpenseOp(userId, "e-4a", {
      date: new Date(),
      amount: 100,
      categoryId,
      description: "  ",
      paymentMethod: "BANK",
    });
    expect(a.ok).toBe(false);

    const b = await createExpenseOp(userId, "e-4b", {
      date: new Date(),
      amount: 0,
      categoryId,
      description: "x",
      paymentMethod: "BANK",
    });
    expect(b.ok).toBe(false);
  });
});

describe("upsertRecurringOp", () => {
  it("creates a new recurring entry", async () => {
    const r = await upsertRecurringOp(userId, "r-1", null, {
      categoryId,
      amount: 150000,
      description: "Monthly rent",
      frequency: "MONTHLY",
      dayOfPeriod: 1,
      active: true,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const row = await prisma.recurringExpense.findUniqueOrThrow({
      where: { id: r.data.id },
    });
    expect(row.frequency).toBe("MONTHLY");
    expect(row.dayOfPeriod).toBe(1);
  });

  it("rejects day-of-week > 6 for WEEKLY", async () => {
    const r = await upsertRecurringOp(userId, "r-2", null, {
      categoryId,
      amount: 10000,
      description: "Bad weekly",
      frequency: "WEEKLY",
      dayOfPeriod: 8,
      active: true,
    });
    expect(r.ok).toBe(false);
  });

  it("rejects day-of-month=0 for MONTHLY", async () => {
    const r = await upsertRecurringOp(userId, "r-3", null, {
      categoryId,
      amount: 10000,
      description: "Bad monthly",
      frequency: "MONTHLY",
      dayOfPeriod: 0,
      active: true,
    });
    expect(r.ok).toBe(false);
  });

  it("updates an existing entry without creating a duplicate", async () => {
    const create = await upsertRecurringOp(userId, "r-4a", null, {
      categoryId,
      amount: 10000,
      description: "Initial",
      frequency: "MONTHLY",
      dayOfPeriod: 15,
      active: true,
    });
    expect(create.ok).toBe(true);
    if (!create.ok) return;

    const upd = await upsertRecurringOp(userId, "r-4b", create.data.id, {
      categoryId,
      amount: 12000,
      description: "Renamed",
      frequency: "MONTHLY",
      dayOfPeriod: 15,
      active: false,
    });
    expect(upd.ok).toBe(true);

    const row = await prisma.recurringExpense.findUniqueOrThrow({
      where: { id: create.data.id },
    });
    expect(row.description).toBe("Renamed");
    expect(row.amount).toBe(12000);
    expect(row.active).toBe(false);

    expect(await prisma.recurringExpense.count()).toBe(1);
  });
});

describe("runDueRecurringOp", () => {
  it("creates an expense for a MONTHLY entry whose dayOfPeriod is today", async () => {
    const today = new Date();
    await prisma.recurringExpense.create({
      data: {
        categoryId,
        amount: 100000,
        description: "Today's bill",
        frequency: "MONTHLY",
        dayOfPeriod: today.getDate(),
        active: true,
      },
    });
    const r = await runDueRecurringOp(userId, "run-1");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.created).toBe(1);

    const exp = await prisma.expense.findFirstOrThrow();
    expect(exp.amount).toBe(100000);
  });

  it("does not double-create when run twice in the same day", async () => {
    const today = new Date();
    await prisma.recurringExpense.create({
      data: {
        categoryId,
        amount: 50000,
        description: "Daily",
        frequency: "MONTHLY",
        dayOfPeriod: today.getDate(),
        active: true,
      },
    });
    const r1 = await runDueRecurringOp(userId, "run-2a");
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    expect(r1.data.created).toBe(1);

    const r2 = await runDueRecurringOp(userId, "run-2b");
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;
    expect(r2.data.created).toBe(0);

    expect(await prisma.expense.count()).toBe(1);
  });

  it("skips inactive entries", async () => {
    const today = new Date();
    await prisma.recurringExpense.create({
      data: {
        categoryId,
        amount: 10000,
        description: "Paused",
        frequency: "MONTHLY",
        dayOfPeriod: today.getDate(),
        active: false,
      },
    });
    const r = await runDueRecurringOp(userId, "run-3");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.created).toBe(0);
  });

  it("skips entries whose dayOfPeriod isn't today", async () => {
    const today = new Date();
    const other = today.getDate() === 15 ? 16 : 15;
    await prisma.recurringExpense.create({
      data: {
        categoryId,
        amount: 10000,
        description: "Other day",
        frequency: "MONTHLY",
        dayOfPeriod: other,
        active: true,
      },
    });
    const r = await runDueRecurringOp(userId, "run-4");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.created).toBe(0);
  });
});
