"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import {
  archiveProductOp,
  createProductOp,
  updateProductOp,
  type ActionResult,
} from "./operations";

async function getCurrentUserId(): Promise<string | null> {
  const session = await auth();
  return (session?.user as { id?: string } | undefined)?.id ?? null;
}

export async function createProduct(
  idempotencyKey: string,
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: "Not authenticated" };

  const result = await createProductOp(userId, idempotencyKey, raw);
  if (result.ok) revalidatePath("/products");
  return result;
}

export async function updateProduct(
  idempotencyKey: string,
  id: string,
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: "Not authenticated" };

  const result = await updateProductOp(userId, idempotencyKey, id, raw);
  if (result.ok) {
    revalidatePath("/products");
    revalidatePath(`/products/${id}`);
  }
  return result;
}

export async function archiveProduct(
  idempotencyKey: string,
  id: string,
): Promise<ActionResult<{ id: string }>> {
  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: "Not authenticated" };

  const result = await archiveProductOp(userId, idempotencyKey, id);
  if (result.ok) {
    revalidatePath("/products");
    revalidatePath(`/products/${id}`);
  }
  return result;
}
