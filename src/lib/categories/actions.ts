"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
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
