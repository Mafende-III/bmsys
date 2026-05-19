"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import {
  closeSessionOp,
  openSessionOp,
  type ActionResult,
} from "./operations";

async function getCurrentUserId(): Promise<string | null> {
  const session = await auth();
  return (session?.user as { id?: string } | undefined)?.id ?? null;
}

export async function openCashSession(
  idempotencyKey: string,
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: "Not authenticated" };

  const r = await openSessionOp(userId, idempotencyKey, raw);
  if (r.ok) {
    revalidatePath("/cash-sessions");
    revalidatePath("/sell");
  }
  return r;
}

export async function closeCashSession(
  idempotencyKey: string,
  id: string,
  raw: unknown,
): Promise<ActionResult<{ id: string; expectedCash: number; variance: number }>> {
  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: "Not authenticated" };

  const r = await closeSessionOp(userId, idempotencyKey, id, raw);
  if (r.ok) {
    revalidatePath("/cash-sessions");
    revalidatePath(`/cash-sessions/${id}`);
    revalidatePath("/sell");
  }
  return r;
}
