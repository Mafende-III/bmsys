"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  deleteIconImage,
  saveIconImage,
} from "@/lib/settings/uploads";
import {
  createCategoryOp,
  updateCategoryOp,
  type ActionResult,
} from "./operations";

async function getCurrentUserId(): Promise<string | null> {
  const session = await auth();
  return (session?.user as { id?: string } | undefined)?.id ?? null;
}

export async function createCategory(
  idempotencyKey: string,
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: "Not authenticated" };

  const result = await createCategoryOp(userId, idempotencyKey, raw);
  if (result.ok) {
    revalidatePath("/categories");
    revalidatePath("/sell");
  }
  return result;
}

export async function updateCategory(
  idempotencyKey: string,
  id: string,
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: "Not authenticated" };

  const result = await updateCategoryOp(userId, idempotencyKey, id, raw);
  if (result.ok) {
    revalidatePath("/categories");
    revalidatePath(`/categories/${id}`);
    revalidatePath("/sell");
  }
  return result;
}

/**
 * Uploads a category icon image. Caller must already be authenticated;
 * the upload writes the file to the volume, then updates the row.
 */
export async function uploadCategoryIcon(
  id: string,
  formData: FormData,
): Promise<ActionResult<{ iconImagePath: string }>> {
  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: "Not authenticated" };

  const file = formData.get("image");
  if (!(file instanceof File)) {
    return { ok: false, error: "No file received" };
  }

  const saved = await saveIconImage({
    subdir: "category-icons",
    recordId: id,
    file,
  });
  if (!saved.ok) return saved;

  try {
    await prisma.$transaction(async (tx) => {
      const before = await tx.category.findUniqueOrThrow({ where: { id } });
      const updated = await tx.category.update({
        where: { id },
        data: { iconImagePath: saved.relativePath },
      });
      await tx.auditLog.create({
        data: {
          tableName: "categories",
          recordId: id,
          action: "UPDATE",
          changes: {
            before: { iconImagePath: before.iconImagePath },
            after: { iconImagePath: updated.iconImagePath },
          } as Prisma.InputJsonValue,
          userId,
        },
      });
    });
  } catch (e: unknown) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to save image",
    };
  }

  revalidatePath("/categories");
  revalidatePath(`/categories/${id}`);
  revalidatePath("/sell");
  return { ok: true, data: { iconImagePath: saved.relativePath } };
}

export async function removeCategoryIcon(
  id: string,
): Promise<ActionResult<{ ok: true }>> {
  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: "Not authenticated" };

  try {
    const before = await prisma.category.findUniqueOrThrow({ where: { id } });
    if (before.iconImagePath) {
      await deleteIconImage(before.iconImagePath);
    }
    await prisma.$transaction(async (tx) => {
      const updated = await tx.category.update({
        where: { id },
        data: { iconImagePath: null },
      });
      await tx.auditLog.create({
        data: {
          tableName: "categories",
          recordId: id,
          action: "UPDATE",
          changes: {
            before: { iconImagePath: before.iconImagePath },
            after: { iconImagePath: updated.iconImagePath },
          } as Prisma.InputJsonValue,
          userId,
        },
      });
    });
  } catch (e: unknown) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to remove image",
    };
  }

  revalidatePath("/categories");
  revalidatePath(`/categories/${id}`);
  revalidatePath("/sell");
  return { ok: true, data: { ok: true } };
}
