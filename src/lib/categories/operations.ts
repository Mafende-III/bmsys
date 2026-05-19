import type { Prisma } from "@prisma/client";
import type { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { withIdempotency } from "@/lib/idempotency";
import {
  categoryCreateSchema,
  categoryUpdateSchema,
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

export async function createCategoryOp(
  userId: string,
  idempotencyKey: string,
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = categoryCreateSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const input = parsed.data;

  try {
    const result = await withIdempotency(
      idempotencyKey,
      "categories.create",
      () =>
        prisma.$transaction(async (tx) => {
          const created = await tx.category.create({ data: input });
          await tx.auditLog.create({
            data: {
              tableName: "categories",
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
      return { ok: false, error: "Name or slug already in use" };
    }
    return { ok: false, error: errorMessage(e, "Failed to create category") };
  }
}

export async function updateCategoryOp(
  userId: string,
  idempotencyKey: string,
  id: string,
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = categoryUpdateSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const input = parsed.data;

  try {
    const result = await withIdempotency(
      idempotencyKey,
      `categories.update.${id}`,
      () =>
        prisma.$transaction(async (tx) => {
          const before = await tx.category.findUniqueOrThrow({ where: { id } });
          const updated = await tx.category.update({
            where: { id },
            data: input,
          });
          await tx.auditLog.create({
            data: {
              tableName: "categories",
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
    if (isPrismaUniqueViolation(e)) {
      return { ok: false, error: "Name already in use" };
    }
    return { ok: false, error: errorMessage(e, "Failed to update category") };
  }
}
