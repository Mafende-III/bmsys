import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import {
  createCategoryOp,
  updateCategoryOp,
} from "@/lib/categories/operations";

const prisma = new PrismaClient({
  datasourceUrl: process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL,
});

let userId: string;
const TEST_USER_PHONE = "+250000999009";

beforeAll(async () => {
  await prisma.$transaction([
    prisma.idempotencyKey.deleteMany({}),
    prisma.auditLog.deleteMany({}),
    prisma.cashSession.deleteMany({}),
    prisma.saleLine.deleteMany({}),
    prisma.sale.deleteMany({}),
    prisma.purchaseLine.deleteMany({}),
    prisma.purchase.deleteMany({}),
    prisma.stockMove.deleteMany({}),
    prisma.carton.deleteMany({}),
    prisma.product.deleteMany({}),
    prisma.category.deleteMany({}),
    prisma.user.deleteMany({ where: { phone: TEST_USER_PHONE } }),
  ]);

  const u = await prisma.user.create({
    data: {
      name: "Cat Test Runner",
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
    prisma.auditLog.deleteMany({ where: { tableName: "categories" } }),
    prisma.product.deleteMany({}),
    prisma.category.deleteMany({}),
  ]);
});

afterAll(async () => {
  await prisma.$disconnect();
});

const validInput = {
  name: "Soft drinks",
  slug: "soft-drinks",
  iconEmoji: "🥤",
  sortOrder: 1,
};

describe("createCategoryOp", () => {
  it("creates a category and writes an INSERT audit row", async () => {
    const r = await createCategoryOp(userId, "ct-1", validInput);
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const created = await prisma.category.findUniqueOrThrow({
      where: { id: r.data.id },
    });
    expect(created.name).toBe("Soft drinks");
    expect(created.iconEmoji).toBe("🥤");
    expect(created.sortOrder).toBe(1);
    expect(created.active).toBe(true);

    const audit = await prisma.auditLog.findFirst({
      where: { tableName: "categories", recordId: r.data.id },
    });
    expect(audit?.action).toBe("INSERT");
  });

  it("rejects duplicate slug", async () => {
    await createCategoryOp(userId, "ct-2a", validInput);
    const r = await createCategoryOp(userId, "ct-2b", validInput);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/already in use/i);
  });

  it("rejects invalid slug", async () => {
    const r = await createCategoryOp(userId, "ct-3", {
      ...validInput,
      slug: "BAD SLUG",
    });
    expect(r.ok).toBe(false);
  });

  it("requires an iconEmoji", async () => {
    const r = await createCategoryOp(userId, "ct-4", {
      ...validInput,
      iconEmoji: "",
    });
    expect(r.ok).toBe(false);
  });
});

describe("updateCategoryOp", () => {
  it("renames + reicons + reactivates without changing slug", async () => {
    const created = await createCategoryOp(userId, "cu-1a", validInput);
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const r = await updateCategoryOp(userId, "cu-1b", created.data.id, {
      name: "Soft Drinks Renamed",
      iconEmoji: "🧃",
      sortOrder: 5,
      active: true,
    });
    expect(r.ok).toBe(true);

    const after = await prisma.category.findUniqueOrThrow({
      where: { id: created.data.id },
    });
    expect(after.name).toBe("Soft Drinks Renamed");
    expect(after.iconEmoji).toBe("🧃");
    expect(after.sortOrder).toBe(5);
    expect(after.slug).toBe("soft-drinks"); // unchanged
  });

  it("can deactivate a category", async () => {
    const created = await createCategoryOp(userId, "cu-2a", validInput);
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const r = await updateCategoryOp(userId, "cu-2b", created.data.id, {
      name: validInput.name,
      iconEmoji: validInput.iconEmoji,
      sortOrder: validInput.sortOrder,
      active: false,
    });
    expect(r.ok).toBe(true);

    const after = await prisma.category.findUniqueOrThrow({
      where: { id: created.data.id },
    });
    expect(after.active).toBe(false);
  });
});
