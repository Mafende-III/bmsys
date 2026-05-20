import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import argon2 from "argon2";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const credentialsSchema = z.object({
  phone: z.string().min(7),
  pin: z.string().min(4),
});

const SESSION_DAYS_DEFAULT = 30;
const SESSION_DAYS_REMEMBER = 90;
const DAY = 24 * 60 * 60;

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  // Cookie max-age covers the longest possible session. The actual
  // expiration is controlled per-token via the jwt callback, so a
  // user who didn't tick "remember me" still expires at 30 days
  // even though the cookie itself could carry 90.
  session: { strategy: "jwt", maxAge: SESSION_DAYS_REMEMBER * DAY },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        phone: { label: "Phone", type: "tel" },
        pin: { label: "PIN", type: "password" },
        remember: { label: "Remember me", type: "checkbox" },
      },
      authorize: async (raw) => {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({
          where: { phone: parsed.data.phone },
        });
        if (!user) return null;
        if (!user.active) return null;

        const ok = await argon2.verify(user.pinHash, parsed.data.pin);
        if (!ok) return null;

        const rawRemember =
          typeof raw?.remember === "string" ? raw.remember : "";
        const remember =
          rawRemember === "on" ||
          rawRemember === "true" ||
          rawRemember === "1";

        return {
          id: user.id,
          name: user.name,
          phone: user.phone,
          role: user.role,
          remember,
        };
      },
    }),
  ],
  callbacks: {
    jwt: ({ token, user }) => {
      if (user) {
        token.id = (user as any).id;
        token.role = (user as any).role;
        token.phone = (user as any).phone;
        const remember = (user as any).remember === true;
        const days = remember
          ? SESSION_DAYS_REMEMBER
          : SESSION_DAYS_DEFAULT;
        token.exp = Math.floor(Date.now() / 1000) + days * DAY;
      }
      return token;
    },
    session: ({ session, token }) => {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
        (session.user as any).phone = token.phone;
      }
      return session;
    },
  },
});
