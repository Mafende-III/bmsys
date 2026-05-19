"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { upsertPriceOverridesOp, type ActionResult } from "./operations";

async function getCurrentUserId(): Promise<string | null> {
  const session = await auth();
  return (session?.user as { id?: string } | undefined)?.id ?? null;
}

export async function saveChannelPrices(
  idempotencyKey: string,
  raw: unknown,
): Promise<ActionResult<{ productId: string; changed: number }>> {
  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: "Not authenticated" };

  const result = await upsertPriceOverridesOp(userId, idempotencyKey, raw);
  if (result.ok) {
    revalidatePath(`/products/${result.data.productId}/prices`);
    revalidatePath(`/products/${result.data.productId}`);
    revalidatePath("/products");
  }
  return result;
}
