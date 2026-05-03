import type { Prisma } from "@prisma/client";
import type { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { withIdempotency } from "@/lib/idempotency";
import {
  productArchiveSchema,
  productCreateSchema,
  productUpdateSchema,
} from "./schema";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function firstError(error: ZodError): string {
  return error.errors[0]?.message ?? "Invalid input";
}

function isPrismaUniqueViolation(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    (e as { code?: string }).code === "P2002"
  );
}

function errorMessage(e: unknown, fallback: string): string {
  return e instanceof Error ? e.message : fallback;
}

/**
 * Create a product. Inner operation — no auth check. Wrap in a Server
 * Action that supplies userId from the session.
 */
export async function createProductOp(
  userId: string,
  idempotencyKey: string,
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = productCreateSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const input = parsed.data;

  try {
    const result = await withIdempotency(idempotencyKey, "products.create", () =>
      prisma.$transaction(async (tx) => {
        const created = await tx.product.create({ data: input });
        await tx.auditLog.create({
          data: {
            tableName: "products",
            recordId: created.id,
            action: "INSERT",
            changes: input as Prisma.InputJsonValue,
            userId,
          },
        });
        return { id: created.id };
      }),
    );
    return { ok: true, data: result };
  } catch (e: unknown) {
    if (isPrismaUniqueViolation(e)) {
      return { ok: false, error: "SKU already in use" };
    }
    return { ok: false, error: errorMessage(e, "Failed to create product") };
  }
}

export async function updateProductOp(
  userId: string,
  idempotencyKey: string,
  id: string,
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = productUpdateSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const input = parsed.data;

  try {
    const result = await withIdempotency(
      idempotencyKey,
      `products.update.${id}`,
      () =>
        prisma.$transaction(async (tx) => {
          const before = await tx.product.findUniqueOrThrow({ where: { id } });
          const updated = await tx.product.update({ where: { id }, data: input });
          await tx.auditLog.create({
            data: {
              tableName: "products",
              recordId: id,
              action: "UPDATE",
              changes: {
                before,
                after: updated,
              } as unknown as Prisma.InputJsonValue,
              userId,
            },
          });
          return { id: updated.id };
        }),
    );
    return { ok: true, data: result };
  } catch (e: unknown) {
    return { ok: false, error: errorMessage(e, "Failed to update product") };
  }
}

/**
 * Soft-delete (active=false). Refuses if total stock != 0 or any OPENED
 * cartons exist. Both checks run inside the transaction so a concurrent
 * stock movement cannot slip past.
 */
export async function archiveProductOp(
  userId: string,
  idempotencyKey: string,
  id: string,
): Promise<ActionResult<{ id: string }>> {
  const parsed = productArchiveSchema.safeParse({ id });
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  try {
    const result = await withIdempotency(
      idempotencyKey,
      `products.archive.${id}`,
      () =>
        prisma.$transaction(async (tx) => {
          const product = await tx.product.findUniqueOrThrow({ where: { id } });

          if (!product.active) {
            return { id }; // already archived; idempotent no-op
          }

          const stockSum = await tx.stockMove.aggregate({
            where: { productId: id },
            _sum: { qtyUnits: true },
          });
          const totalUnits = stockSum._sum.qtyUnits ?? 0;
          if (totalUnits !== 0) {
            throw new Error(
              `Cannot archive: product has ${totalUnits} units in stock`,
            );
          }

          const openedCount = await tx.carton.count({
            where: { productId: id, state: "OPENED" },
          });
          if (openedCount > 0) {
            throw new Error(
              `Cannot archive: product has ${openedCount} open carton(s)`,
            );
          }

          const archived = await tx.product.update({
            where: { id },
            data: { active: false },
          });
          await tx.auditLog.create({
            data: {
              tableName: "products",
              recordId: id,
              action: "UPDATE",
              changes: {
                archived: true,
                before: product,
              } as unknown as Prisma.InputJsonValue,
              userId,
            },
          });
          return { id: archived.id };
        }),
    );
    return { ok: true, data: result };
  } catch (e: unknown) {
    return { ok: false, error: errorMessage(e, "Failed to archive product") };
  }
}
