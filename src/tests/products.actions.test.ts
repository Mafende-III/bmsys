import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import {
  archiveProductOp,
  createProductOp,
  updateProductOp,
} from "@/lib/products/operations";

const prisma = new PrismaClient({
  datasourceUrl: process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL,
});

let userId: string;

// Dedicated phone so the test runner's User row never collides with the
// seeded owner. If DATABASE_URL == TEST_DATABASE_URL (single dev DB),
// trampling the owner row would break interactive login.
const TEST_USER_PHONE = "+250000999001";

const validInput = {
  sku: "TEST-PROD-001",
  name: "Test Beverage",
  category: "Water",
  unitsPerCarton: 12,
  costPerCarton: 4500,
  unitPrice: 600,
  cartonPrice: 6800,
  sellableAsUnit: true,
  sellableAsCarton: true,
  lowStockThresholdUnits: 5,
  loyaltyPointsPerUnit: 0,
};

beforeAll(async () => {
  // Full FK-ordered wipe of everything this file (or earlier files such
  // as golden.test.ts) might have left behind. We do NOT wipe all Users
  // — only this file's own runner row — so the seeded owner survives.
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
    prisma.product.deleteMany({}),
    prisma.user.deleteMany({ where: { phone: TEST_USER_PHONE } }),
  ]);

  const u = await prisma.user.create({
    data: {
      name: "Test Runner",
      phone: TEST_USER_PHONE,
      pinHash: "x", // never authenticates via Auth.js
      role: "OWNER",
    },
  });
  userId = u.id;
});

beforeEach(async () => {
  await prisma.$transaction([
    prisma.idempotencyKey.deleteMany({}),
    prisma.auditLog.deleteMany({ where: { tableName: "products" } }),
    prisma.stockMove.deleteMany({}),
    prisma.carton.deleteMany({}),
    prisma.product.deleteMany({}),
  ]);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("createProductOp", () => {
  it("creates a product and writes an INSERT audit row", async () => {
    const result = await createProductOp(userId, "key-create-1", validInput);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const created = await prisma.product.findUnique({
      where: { id: result.data.id },
    });
    expect(created).not.toBeNull();
    expect(created?.sku).toBe(validInput.sku);

    const audits = await prisma.auditLog.findMany({
      where: {
        tableName: "products",
        recordId: result.data.id,
        action: "INSERT",
      },
    });
    expect(audits).toHaveLength(1);
  });

  it("rejects duplicate SKU with a friendly error", async () => {
    const r1 = await createProductOp(userId, "key-create-2a", validInput);
    expect(r1.ok).toBe(true);

    const r2 = await createProductOp(userId, "key-create-2b", validInput);
    expect(r2.ok).toBe(false);
    if (!r2.ok) {
      expect(r2.error).toMatch(/SKU already in use/i);
    }
  });

  it("returns the cached result when the same idempotency key is reused", async () => {
    const r1 = await createProductOp(userId, "key-create-3", validInput);
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;

    const r2 = await createProductOp(userId, "key-create-3", validInput);
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;

    expect(r2.data.id).toBe(r1.data.id);
    const count = await prisma.product.count();
    expect(count).toBe(1);
  });

  it("rejects invalid input via Zod (both sellable flags false)", async () => {
    const result = await createProductOp(userId, "key-create-4", {
      ...validInput,
      sellableAsUnit: false,
      sellableAsCarton: false,
    });
    expect(result.ok).toBe(false);
  });
});

describe("updateProductOp", () => {
  it("updates a product and writes an UPDATE audit row", async () => {
    const created = await createProductOp(userId, "key-upd-1a", validInput);
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const result = await updateProductOp(
      userId,
      "key-upd-1b",
      created.data.id,
      {
        name: "Renamed",
        category: "Water",
        unitsPerCarton: 12,
        costPerCarton: 4500,
        unitPrice: 700,
        cartonPrice: 8000,
        sellableAsUnit: true,
        sellableAsCarton: true,
        lowStockThresholdUnits: 5,
        loyaltyPointsPerUnit: 0,
      },
    );
    expect(result.ok).toBe(true);

    const after = await prisma.product.findUniqueOrThrow({
      where: { id: created.data.id },
    });
    expect(after.name).toBe("Renamed");
    expect(after.unitPrice).toBe(700);

    const audits = await prisma.auditLog.findMany({
      where: {
        tableName: "products",
        recordId: created.data.id,
        action: "UPDATE",
      },
    });
    expect(audits.length).toBeGreaterThanOrEqual(1);
  });
});

describe("archiveProductOp", () => {
  it("archives a product when stock is zero and no open cartons", async () => {
    const created = await createProductOp(userId, "key-arch-1a", validInput);
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const result = await archiveProductOp(
      userId,
      "key-arch-1b",
      created.data.id,
    );
    expect(result.ok).toBe(true);

    const after = await prisma.product.findUniqueOrThrow({
      where: { id: created.data.id },
    });
    expect(after.active).toBe(false);
  });

  it("refuses to archive when stock_moves sum is non-zero", async () => {
    const created = await createProductOp(userId, "key-arch-2a", validInput);
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    await prisma.stockMove.create({
      data: {
        productId: created.data.id,
        qtyUnits: 24,
        reason: "PURCHASE",
        userId,
      },
    });

    const result = await archiveProductOp(
      userId,
      "key-arch-2b",
      created.data.id,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/units in stock/i);
    }

    const after = await prisma.product.findUniqueOrThrow({
      where: { id: created.data.id },
    });
    expect(after.active).toBe(true);
  });

  it("refuses to archive when an OPENED carton exists", async () => {
    const created = await createProductOp(userId, "key-arch-3a", validInput);
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    await prisma.carton.create({
      data: {
        productId: created.data.id,
        tag: "ARCH-TEST-CTN-001",
        state: "OPENED",
        unitsRemaining: 0,
        openedByUserId: userId,
      },
    });

    const result = await archiveProductOp(
      userId,
      "key-arch-3b",
      created.data.id,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/open carton/i);
    }
  });

  it("is a no-op when called on an already-archived product", async () => {
    const created = await createProductOp(userId, "key-arch-4a", validInput);
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const r1 = await archiveProductOp(userId, "key-arch-4b", created.data.id);
    expect(r1.ok).toBe(true);

    const r2 = await archiveProductOp(userId, "key-arch-4c", created.data.id);
    expect(r2.ok).toBe(true);

    const after = await prisma.product.findUniqueOrThrow({
      where: { id: created.data.id },
    });
    expect(after.active).toBe(false);
  });
});
