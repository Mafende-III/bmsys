"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { userCanSellOnChannel } from "@/lib/permissions";
import { createSaleOp, type ActionResult } from "./operations";

const CHANNEL_COOKIE = "bmsys.channel";

async function getCurrentUserId(): Promise<string | null> {
  const session = await auth();
  return (session?.user as { id?: string } | undefined)?.id ?? null;
}

export async function setActiveChannel(
  channelId: string,
): Promise<ActionResult<{ channelId: string }>> {
  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: "Not authenticated" };

  if (!(await userCanSellOnChannel(userId, channelId))) {
    return { ok: false, error: "Not authorized on this channel" };
  }

  const store = await cookies();
  store.set(CHANNEL_COOKIE, channelId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });

  revalidatePath("/sell");
  return { ok: true, data: { channelId } };
}

export async function getActiveChannelId(): Promise<string | null> {
  const store = await cookies();
  return store.get(CHANNEL_COOKIE)?.value ?? null;
}

export async function createSale(
  idempotencyKey: string,
  raw: unknown,
): Promise<ActionResult<{ saleId: string; total: number }>> {
  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: "Not authenticated" };

  const result = await createSaleOp(userId, idempotencyKey, raw);
  if (result.ok) {
    revalidatePath("/sell");
    revalidatePath("/products");
  }
  return result;
}
