"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import {
  createChannelOp,
  deactivateChannelOp,
  reactivateChannelOp,
  updateChannelOp,
  type ActionResult,
} from "./operations";

async function getCurrentUserId(): Promise<string | null> {
  const session = await auth();
  return (session?.user as { id?: string } | undefined)?.id ?? null;
}

export async function createChannel(
  idempotencyKey: string,
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: "Not authenticated" };

  const result = await createChannelOp(userId, idempotencyKey, raw);
  if (result.ok) revalidatePath("/channels");
  return result;
}

export async function updateChannel(
  idempotencyKey: string,
  id: string,
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: "Not authenticated" };

  const result = await updateChannelOp(userId, idempotencyKey, id, raw);
  if (result.ok) {
    revalidatePath("/channels");
    revalidatePath(`/channels/${id}`);
  }
  return result;
}

export async function deactivateChannel(
  idempotencyKey: string,
  id: string,
): Promise<ActionResult<{ id: string }>> {
  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: "Not authenticated" };

  const result = await deactivateChannelOp(userId, idempotencyKey, id);
  if (result.ok) {
    revalidatePath("/channels");
    revalidatePath(`/channels/${id}`);
  }
  return result;
}

export async function reactivateChannel(
  idempotencyKey: string,
  id: string,
): Promise<ActionResult<{ id: string }>> {
  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: "Not authenticated" };

  const result = await reactivateChannelOp(userId, idempotencyKey, id);
  if (result.ok) {
    revalidatePath("/channels");
    revalidatePath(`/channels/${id}`);
  }
  return result;
}
