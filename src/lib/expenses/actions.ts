"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import {
  createExpenseOp,
  runDueRecurringOp,
  upsertRecurringOp,
  type ActionResult,
} from "./operations";

async function getCurrentUserId(): Promise<string | null> {
  const session = await auth();
  return (session?.user as { id?: string } | undefined)?.id ?? null;
}

export async function createExpense(
  idempotencyKey: string,
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: "Not authenticated" };

  const r = await createExpenseOp(userId, idempotencyKey, raw);
  if (r.ok) revalidatePath("/expenses");
  return r;
}

export async function upsertRecurring(
  idempotencyKey: string,
  id: string | null,
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: "Not authenticated" };

  const r = await upsertRecurringOp(userId, idempotencyKey, id, raw);
  if (r.ok) {
    revalidatePath("/expenses/recurring");
    if (id) revalidatePath(`/expenses/recurring/${id}`);
  }
  return r;
}

export async function runRecurringNow(
  idempotencyKey: string,
): Promise<ActionResult<{ created: number }>> {
  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: "Not authenticated" };

  const r = await runDueRecurringOp(userId, idempotencyKey);
  if (r.ok) {
    revalidatePath("/expenses");
    revalidatePath("/expenses/recurring");
  }
  return r;
}
