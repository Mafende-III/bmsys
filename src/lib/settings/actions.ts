"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import {
  updateLogoPathOp,
  updateSettingsOp,
  type ActionResult,
} from "./operations";
import { saveLogoFile } from "./uploads";

async function getCurrentUserId(): Promise<string | null> {
  const session = await auth();
  return (session?.user as { id?: string } | undefined)?.id ?? null;
}

export async function updateSettings(
  idempotencyKey: string,
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: "Not authenticated" };

  const result = await updateSettingsOp(userId, idempotencyKey, raw);
  if (result.ok) {
    revalidatePath("/", "layout");
  }
  return result;
}

export async function uploadLogo(
  formData: FormData,
): Promise<ActionResult<{ logoPath: string }>> {
  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: "Not authenticated" };

  const file = formData.get("logo");
  if (!(file instanceof File)) {
    return { ok: false, error: "No file received" };
  }
  const saved = await saveLogoFile(file);
  if (!saved.ok) return saved;

  const updated = await updateLogoPathOp(userId, saved.relativePath);
  if (!updated.ok) return updated;

  revalidatePath("/", "layout");
  return { ok: true, data: { logoPath: saved.relativePath } };
}

export async function removeLogo(): Promise<ActionResult<{ ok: true }>> {
  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: "Not authenticated" };

  const updated = await updateLogoPathOp(userId, null);
  if (!updated.ok) return updated;
  revalidatePath("/", "layout");
  return { ok: true, data: { ok: true } };
}
