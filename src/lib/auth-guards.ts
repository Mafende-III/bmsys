/**
 * Helpers used at the top of every authenticated page. They centralize
 * the auth() + role check pattern so individual pages stay short.
 */
import type { Session } from "next-auth";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export type SessionUser = {
  id: string;
  name?: string | null;
  phone?: string | null;
  role: "OWNER" | "SELLER";
};

function readUser(session: Session | null): SessionUser | null {
  if (!session?.user) return null;
  const u = session.user as Partial<SessionUser>;
  if (!u.id || !u.role) return null;
  return {
    id: u.id,
    name: u.name ?? null,
    phone: u.phone ?? null,
    role: u.role,
  };
}

export async function requireSeller(): Promise<SessionUser> {
  const session = (await auth()) as Session | null;
  const user = readUser(session);
  if (!user) redirect("/login");
  return user;
}

export async function requireOwner(): Promise<SessionUser> {
  const user = await requireSeller();
  if (user.role !== "OWNER") redirect("/sell");
  return user;
}
