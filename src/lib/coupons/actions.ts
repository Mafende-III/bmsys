"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import {
  createCouponOp,
  previewCouponOp,
  revokeCouponOp,
  type CouponPreview,
} from "./operations";

async function currentUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

export async function createCoupon(raw: unknown) {
  const userId = await currentUserId();
  if (!userId) return { ok: false as const, error: "Not authenticated" };
  const r = await createCouponOp(userId, raw);
  if (r.ok) {
    revalidatePath("/coupons");
  }
  return r;
}

export async function revokeCoupon(couponId: string) {
  const userId = await currentUserId();
  if (!userId) return { ok: false as const, error: "Not authenticated" };
  const r = await revokeCouponOp(userId, couponId);
  if (r.ok) {
    revalidatePath("/coupons");
  }
  return r;
}

export async function previewCoupon(
  code: string,
  items: Array<{
    productId: string;
    saleUnit: "UNIT" | "CARTON";
    qty: number;
  }>,
  channelId: string,
): Promise<CouponPreview> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, error: "Not authenticated" };
  return previewCouponOp(code, items, channelId);
}
