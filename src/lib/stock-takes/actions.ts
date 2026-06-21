"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { runStockTakeOp, type ActionResult, type StockTakeResult } from "./operations";

async function getCurrentUserId(): Promise<string | null> {
  const session = await auth();
  return (session?.user as { id?: string } | undefined)?.id ?? null;
}

export async function runStockTake(
  idempotencyKey: string,
  raw: unknown,
): Promise<ActionResult<StockTakeResult>> {
  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: "Not authenticated" };

  const result = await runStockTakeOp(userId, idempotencyKey, raw);
  if (result.ok) {
    revalidatePath("/stock-take");
    revalidatePath("/products");
    revalidatePath("/analytics");
    revalidatePath("/my-day");
    revalidatePath("/sell");
  }
  return result;
}
