"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { createAdjustmentOp, type ActionResult } from "./operations";

async function getCurrentUserId(): Promise<string | null> {
  const session = await auth();
  return (session?.user as { id?: string } | undefined)?.id ?? null;
}

export async function createAdjustment(
  idempotencyKey: string,
  raw: unknown,
): Promise<ActionResult<{ id: string; remainingStock: number }>> {
  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: "Not authenticated" };

  const r = await createAdjustmentOp(userId, idempotencyKey, raw);
  if (r.ok) {
    revalidatePath("/adjustments");
    revalidatePath("/products");
  }
  return r;
}
