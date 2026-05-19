import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import {
  createSupplierOp,
  updateSupplierOp,
} from "@/lib/suppliers/operations";

const prisma = new PrismaClient({
  datasourceUrl: process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL,
});

let userId: string;
const TEST_USER_PHONE = "+250000999005";

beforeAll(async () => {
  await prisma.$transaction([
    prisma.idempotencyKey.deleteMany({}),
    prisma.auditLog.deleteMany({}),
    prisma.purchaseLine.deleteMany({}),
    prisma.purchase.deleteMany({}),
    prisma.supplier.deleteMany({}),
    prisma.user.deleteMany({ where: { phone: TEST_USER_PHONE } }),
  ]);

  const u = await prisma.user.create({
    data: {
      name: "Suppliers Test Runner",
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
    prisma.auditLog.deleteMany({ where: { tableName: "suppliers" } }),
    prisma.purchaseLine.deleteMany({}),
    prisma.purchase.deleteMany({}),
    prisma.supplier.deleteMany({}),
  ]);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("createSupplierOp", () => {
  it("creates a supplier and writes an INSERT audit row", async () => {
    const r = await createSupplierOp(userId, "sup-1", {
      name: "Bralirwa",
      phone: "+250788123456",
      notes: "Net-30",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const created = await prisma.supplier.findUniqueOrThrow({
      where: { id: r.data.id },
    });
    expect(created.name).toBe("Bralirwa");
    expect(created.phone).toBe("+250788123456");
    expect(created.notes).toBe("Net-30");

    const audits = await prisma.auditLog.findMany({
      where: {
        tableName: "suppliers",
        recordId: r.data.id,
        action: "INSERT",
      },
    });
    expect(audits).toHaveLength(1);
  });

  it("accepts a supplier with no phone or notes", async () => {
    const r = await createSupplierOp(userId, "sup-2", { name: "Walk-in" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const created = await prisma.supplier.findUniqueOrThrow({
      where: { id: r.data.id },
    });
    expect(created.phone).toBeNull();
    expect(created.notes).toBeNull();
  });

  it("returns cached result for the same idempotency key", async () => {
    const input = { name: "Inyange" };
    const r1 = await createSupplierOp(userId, "sup-3", input);
    expect(r1.ok).toBe(true);
    const r2 = await createSupplierOp(userId, "sup-3", input);
    expect(r2.ok).toBe(true);

    expect(await prisma.supplier.count()).toBe(1);
  });

  it("rejects empty name via Zod", async () => {
    const r = await createSupplierOp(userId, "sup-4", { name: "" });
    expect(r.ok).toBe(false);
  });
});

describe("updateSupplierOp", () => {
  it("renames a supplier and writes an UPDATE audit row", async () => {
    const created = await createSupplierOp(userId, "supu-1a", {
      name: "Original Name",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const r = await updateSupplierOp(userId, "supu-1b", created.data.id, {
      name: "Renamed",
      phone: "+250788999999",
      notes: "Updated note",
    });
    expect(r.ok).toBe(true);

    const after = await prisma.supplier.findUniqueOrThrow({
      where: { id: created.data.id },
    });
    expect(after.name).toBe("Renamed");
    expect(after.phone).toBe("+250788999999");
    expect(after.notes).toBe("Updated note");

    const audits = await prisma.auditLog.findMany({
      where: {
        tableName: "suppliers",
        recordId: created.data.id,
        action: "UPDATE",
      },
    });
    expect(audits.length).toBeGreaterThanOrEqual(1);
  });

  it("clears optional fields when blank strings are passed", async () => {
    const created = await createSupplierOp(userId, "supu-2a", {
      name: "Has Phone",
      phone: "+250788111111",
      notes: "Some notes",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const r = await updateSupplierOp(userId, "supu-2b", created.data.id, {
      name: "Has Phone",
      phone: "",
      notes: "",
    });
    expect(r.ok).toBe(true);

    const after = await prisma.supplier.findUniqueOrThrow({
      where: { id: created.data.id },
    });
    expect(after.phone).toBeNull();
    expect(after.notes).toBeNull();
  });
});
