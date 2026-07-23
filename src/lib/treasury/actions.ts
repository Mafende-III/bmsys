"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { recordCashTransferOp, setCheckpointsOp } from "./operations";

async function currentUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

export async function recordCashTransfer(raw: unknown) {
  const userId = await currentUserId();
  if (!userId) return { ok: false as const, error: "Not authenticated" };
  const r = await recordCashTransferOp(userId, raw);
  if (r.ok) {
    revalidatePath("/dashboard");
    revalidatePath("/cash-sessions");
  }
  return r;
}

export async function setTreasuryCheckpoints(raw: unknown) {
  const userId = await currentUserId();
  if (!userId) return { ok: false as const, error: "Not authenticated" };
  const r = await setCheckpointsOp(userId, raw);
  if (r.ok) {
    revalidatePath("/dashboard");
    revalidatePath("/settings");
  }
  return r;
}
