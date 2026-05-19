import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import {
  cancelPurchaseOp,
  receivePurchaseOp,
  savePurchaseDraftOp,
} from "@/lib/purchases/operations";

const prisma = new PrismaClient({
  datasourceUrl: process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL,
});

let userId: string;
let supplierId: string;
let productAId: string;
let productBId: string;
const TEST_USER_PHONE = "+250000999006";

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
    prisma.supplier.deleteMany({}),
    prisma.user.deleteMany({ where: { phone: TEST_USER_PHONE } }),
  ]);
});

beforeEach(async () => {
  await prisma.$transaction([
    prisma.idempotencyKey.deleteMany({}),
    prisma.auditLog.deleteMany({}),
    prisma.purchaseLine.deleteMany({}),
    prisma.purchase.deleteMany({}),
    prisma.stockMove.deleteMany({}),
    prisma.product.deleteMany({}),
    prisma.supplier.deleteMany({}),
    prisma.user.deleteMany({ where: { phone: TEST_USER_PHONE } }),
  ]);

  const user = await prisma.user.create({
    data: {
      name: "Purchases Test Runner",
      phone: TEST_USER_PHONE,
      pinHash: "x",
      role: "OWNER",
    },
  });
  userId = user.id;

  const supplier = await prisma.supplier.create({
    data: { name: "Test Supplier" },
  });
  supplierId = supplier.id;

  const [a, b] = await Promise.all([
    prisma.product.create({
      data: {
        sku: "TEST-A",
        name: "Test Product A",
        unitsPerCarton: 12,
        costPerCarton: 4500,
        unitPrice: 600,
        cartonPrice: 6800,
      },
    }),
    prisma.product.create({
      data: {
        sku: "TEST-B",
        name: "Test Product B",
        unitsPerCarton: 24,
        costPerCarton: 7200,
        unitPrice: 400,
        cartonPrice: 8400,
      },
    }),
  ]);
  productAId = a.id;
  productBId = b.id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

const draftInput = () => ({
  supplierId,
  date: new Date(),
  note: "Test purchase",
  lines: [
    { productId: productAId, qtyCartons: 5, qtyLooseUnits: 0, unitCost: 4500 },
    { productId: productBId, qtyCartons: 2, qtyLooseUnits: 0, unitCost: 7200 },
  ],
});

describe("savePurchaseDraftOp", () => {
  it("creates a DRAFT with the supplied lines + correct totalCost", async () => {
    const r = await savePurchaseDraftOp(userId, "p-1", null, draftInput());
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const created = await prisma.purchase.findUniqueOrThrow({
      where: { id: r.data.id },
      include: { lines: true },
    });
    expect(created.status).toBe("DRAFT");
    expect(created.lines).toHaveLength(2);
    // 5*4500 + 2*7200 = 22500 + 14400 = 36900
    expect(created.totalCost).toBe(36900);
  });

  it("rejects an empty line list as save (still allowed; empty draft is fine)", async () => {
    const r = await savePurchaseDraftOp(userId, "p-2", null, {
      supplierId,
      date: new Date(),
      note: "",
      lines: [],
    });
    expect(r.ok).toBe(true);
  });

  it("rejects line with zero quantity (Zod refine)", async () => {
    const r = await savePurchaseDraftOp(userId, "p-3", null, {
      supplierId,
      date: new Date(),
      lines: [
        {
          productId: productAId,
          qtyCartons: 0,
          qtyLooseUnits: 0,
          unitCost: 4500,
        },
      ],
    });
    expect(r.ok).toBe(false);
  });

  it("rejects update of a non-DRAFT purchase", async () => {
    const create = await savePurchaseDraftOp(
      userId,
      "p-4a",
      null,
      draftInput(),
    );
    expect(create.ok).toBe(true);
    if (!create.ok) return;

    const recv = await receivePurchaseOp(userId, "p-4b", create.data.id);
    expect(recv.ok).toBe(true);

    const r = await savePurchaseDraftOp(
      userId,
      "p-4c",
      create.data.id,
      draftInput(),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/Cannot edit/i);
  });

  it("replaces all lines on update (idempotent line reconciliation)", async () => {
    const create = await savePurchaseDraftOp(
      userId,
      "p-5a",
      null,
      draftInput(),
    );
    expect(create.ok).toBe(true);
    if (!create.ok) return;

    // Update with a single line
    const upd = await savePurchaseDraftOp(userId, "p-5b", create.data.id, {
      supplierId,
      date: new Date(),
      note: "Updated",
      lines: [
        {
          productId: productAId,
          qtyCartons: 1,
          qtyLooseUnits: 0,
          unitCost: 4500,
        },
      ],
    });
    expect(upd.ok).toBe(true);

    const after = await prisma.purchase.findUniqueOrThrow({
      where: { id: create.data.id },
      include: { lines: true },
    });
    expect(after.lines).toHaveLength(1);
    expect(after.totalCost).toBe(4500);
  });
});

describe("receivePurchaseOp", () => {
  it("writes stock_moves for each line and flips status to RECEIVED", async () => {
    const create = await savePurchaseDraftOp(
      userId,
      "r-1a",
      null,
      draftInput(),
    );
    expect(create.ok).toBe(true);
    if (!create.ok) return;

    const r = await receivePurchaseOp(userId, "r-1b", create.data.id);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.movesCreated).toBe(2);

    const after = await prisma.purchase.findUniqueOrThrow({
      where: { id: create.data.id },
    });
    expect(after.status).toBe("RECEIVED");

    const aSum = await prisma.stockMove.aggregate({
      where: { productId: productAId },
      _sum: { qtyUnits: true },
    });
    const bSum = await prisma.stockMove.aggregate({
      where: { productId: productBId },
      _sum: { qtyUnits: true },
    });
    expect(aSum._sum.qtyUnits).toBe(5 * 12);
    expect(bSum._sum.qtyUnits).toBe(2 * 24);
  });

  it("refuses to receive an empty draft", async () => {
    const create = await savePurchaseDraftOp(userId, "r-2a", null, {
      supplierId,
      date: new Date(),
      note: "",
      lines: [],
    });
    expect(create.ok).toBe(true);
    if (!create.ok) return;

    const r = await receivePurchaseOp(userId, "r-2b", create.data.id);
    expect(r.ok).toBe(false);
  });

  it("is a no-op when already RECEIVED (idempotent)", async () => {
    const create = await savePurchaseDraftOp(
      userId,
      "r-3a",
      null,
      draftInput(),
    );
    expect(create.ok).toBe(true);
    if (!create.ok) return;

    const r1 = await receivePurchaseOp(userId, "r-3b", create.data.id);
    expect(r1.ok).toBe(true);

    const r2 = await receivePurchaseOp(userId, "r-3c", create.data.id);
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;
    expect(r2.data.movesCreated).toBe(0);

    const moveCount = await prisma.stockMove.count();
    expect(moveCount).toBe(2);
  });
});

describe("cancelPurchaseOp", () => {
  it("cancels a DRAFT without touching stock", async () => {
    const create = await savePurchaseDraftOp(
      userId,
      "c-1a",
      null,
      draftInput(),
    );
    expect(create.ok).toBe(true);
    if (!create.ok) return;

    const r = await cancelPurchaseOp(userId, "c-1b", create.data.id);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.reversingMoves).toBe(0);

    const after = await prisma.purchase.findUniqueOrThrow({
      where: { id: create.data.id },
    });
    expect(after.status).toBe("CANCELLED");

    expect(await prisma.stockMove.count()).toBe(0);
  });

  it("cancels a RECEIVED purchase by writing RETURN moves", async () => {
    const create = await savePurchaseDraftOp(
      userId,
      "c-2a",
      null,
      draftInput(),
    );
    expect(create.ok).toBe(true);
    if (!create.ok) return;

    await receivePurchaseOp(userId, "c-2b", create.data.id);

    const r = await cancelPurchaseOp(userId, "c-2c", create.data.id);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.reversingMoves).toBe(2);

    // Stock should be back to 0 for both products
    const aSum = await prisma.stockMove.aggregate({
      where: { productId: productAId },
      _sum: { qtyUnits: true },
    });
    const bSum = await prisma.stockMove.aggregate({
      where: { productId: productBId },
      _sum: { qtyUnits: true },
    });
    expect(aSum._sum.qtyUnits).toBe(0);
    expect(bSum._sum.qtyUnits).toBe(0);

    const reverses = await prisma.stockMove.findMany({
      where: { reason: "RETURN" },
    });
    expect(reverses).toHaveLength(2);
  });

  it("refuses to cancel RECEIVED if stock has been partially sold", async () => {
    const create = await savePurchaseDraftOp(
      userId,
      "c-3a",
      null,
      draftInput(),
    );
    expect(create.ok).toBe(true);
    if (!create.ok) return;

    await receivePurchaseOp(userId, "c-3b", create.data.id);

    // Burn 10 units of product A so the cancel can't fully reverse 60 (5*12)
    // Actually we received 60 — sell 55 of them so only 5 remain, less than 60
    await prisma.stockMove.create({
      data: {
        productId: productAId,
        qtyUnits: -55,
        reason: "SALE_UNIT",
        userId,
      },
    });

    const r = await cancelPurchaseOp(userId, "c-3c", create.data.id);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toMatch(/already gone|Adjustment/i);
    }

    // Status stayed RECEIVED, no return moves were written
    const after = await prisma.purchase.findUniqueOrThrow({
      where: { id: create.data.id },
    });
    expect(after.status).toBe("RECEIVED");
    const reverses = await prisma.stockMove.count({
      where: { reason: "RETURN" },
    });
    expect(reverses).toBe(0);
  });
});
