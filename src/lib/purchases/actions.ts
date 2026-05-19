"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import {
  cancelPurchaseOp,
  receivePurchaseOp,
  savePurchaseDraftOp,
  type ActionResult,
} from "./operations";

async function getCurrentUserId(): Promise<string | null> {
  const session = await auth();
  return (session?.user as { id?: string } | undefined)?.id ?? null;
}

export async function savePurchaseDraft(
  idempotencyKey: string,
  purchaseId: string | null,
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: "Not authenticated" };

  const result = await savePurchaseDraftOp(
    userId,
    idempotencyKey,
    purchaseId,
    raw,
  );
  if (result.ok) {
    revalidatePath("/purchases");
    revalidatePath(`/purchases/${result.data.id}`);
  }
  return result;
}

export async function receivePurchase(
  idempotencyKey: string,
  id: string,
): Promise<ActionResult<{ id: string; movesCreated: number }>> {
  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: "Not authenticated" };

  const result = await receivePurchaseOp(userId, idempotencyKey, id);
  if (result.ok) {
    revalidatePath("/purchases");
    revalidatePath(`/purchases/${id}`);
    revalidatePath("/products");
  }
  return result;
}

export async function cancelPurchase(
  idempotencyKey: string,
  id: string,
): Promise<ActionResult<{ id: string; reversingMoves: number }>> {
  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: "Not authenticated" };

  const result = await cancelPurchaseOp(userId, idempotencyKey, id);
  if (result.ok) {
    revalidatePath("/purchases");
    revalidatePath(`/purchases/${id}`);
    revalidatePath("/products");
  }
  return result;
}
