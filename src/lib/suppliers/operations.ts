import type { Prisma } from "@prisma/client";
import type { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { withIdempotency } from "@/lib/idempotency";
import {
  supplierCreateSchema,
  supplierUpdateSchema,
} from "./schema";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function firstError(error: ZodError): string {
  return error.errors[0]?.message ?? "Invalid input";
}

function errorMessage(e: unknown, fallback: string): string {
  return e instanceof Error ? e.message : fallback;
}

export async function createSupplierOp(
  userId: string,
  idempotencyKey: string,
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = supplierCreateSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const input = parsed.data;

  try {
    const result = await withIdempotency(
      idempotencyKey,
      "suppliers.create",
      () =>
        prisma.$transaction(async (tx) => {
          const created = await tx.supplier.create({ data: input });
          await tx.auditLog.create({
            data: {
              tableName: "suppliers",
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
    return { ok: false, error: errorMessage(e, "Failed to create supplier") };
  }
}

export async function updateSupplierOp(
  userId: string,
  idempotencyKey: string,
  id: string,
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = supplierUpdateSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const input = parsed.data;

  try {
    const result = await withIdempotency(
      idempotencyKey,
      `suppliers.update.${id}`,
      () =>
        prisma.$transaction(async (tx) => {
          const before = await tx.supplier.findUniqueOrThrow({
            where: { id },
          });
          // Map undefined -> null so that submitting a blank phone or
          // notes field clears the existing value instead of leaving it
          // untouched (Prisma treats undefined as "skip this field").
          const updated = await tx.supplier.update({
            where: { id },
            data: {
              name: input.name,
              phone: input.phone ?? null,
              notes: input.notes ?? null,
            },
          });
          await tx.auditLog.create({
            data: {
              tableName: "suppliers",
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
    return { ok: false, error: errorMessage(e, "Failed to update supplier") };
  }
}
