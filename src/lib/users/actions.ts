"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import {
  createUserOp,
  updateProfileOp,
  updateUserOp,
  type ActionResult,
} from "./operations";

async function getCurrentUserId(): Promise<string | null> {
  const session = await auth();
  return (session?.user as { id?: string } | undefined)?.id ?? null;
}

export async function createUser(
  idempotencyKey: string,
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: "Not authenticated" };

  const result = await createUserOp(userId, idempotencyKey, raw);
  if (result.ok) revalidatePath("/users");
  return result;
}

export async function updateUser(
  idempotencyKey: string,
  id: string,
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: "Not authenticated" };

  const result = await updateUserOp(userId, idempotencyKey, id, raw);
  if (result.ok) {
    revalidatePath("/users");
    revalidatePath(`/users/${id}`);
  }
  return result;
}

export async function updateMyProfile(
  idempotencyKey: string,
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: "Not authenticated" };

  const result = await updateProfileOp(userId, idempotencyKey, raw);
  if (result.ok) {
    revalidatePath("/profile");
    revalidatePath("/dashboard");
  }
  return result;
}
