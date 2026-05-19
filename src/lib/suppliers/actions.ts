"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import {
  createSupplierOp,
  updateSupplierOp,
  type ActionResult,
} from "./operations";

async function getCurrentUserId(): Promise<string | null> {
  const session = await auth();
  return (session?.user as { id?: string } | undefined)?.id ?? null;
}

export async function createSupplier(
  idempotencyKey: string,
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: "Not authenticated" };

  const result = await createSupplierOp(userId, idempotencyKey, raw);
  if (result.ok) revalidatePath("/suppliers");
  return result;
}

export async function updateSupplier(
  idempotencyKey: string,
  id: string,
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: "Not authenticated" };

  const result = await updateSupplierOp(userId, idempotencyKey, id, raw);
  if (result.ok) {
    revalidatePath("/suppliers");
    revalidatePath(`/suppliers/${id}`);
  }
  return result;
}
