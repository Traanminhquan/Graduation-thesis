import { Prisma } from "@prisma/client";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/db";

import { SESSION_COOKIE, sessionMatchesPassword, verifySessionToken } from "./session";

/**
 * The only user shape that is ever sent to the browser: no passwordHash,
 * explicitly projected after the internal password fingerprint check.
 */
export const publicUserSelect = {
  id: true,
  email: true,
  name: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
  createdAt: Date;
};

/**
 * Reads and verifies the session cookie, then re-loads the user from the
 * database (so a deleted user cannot keep browsing on a stale cookie).
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const payload = verifySessionToken(token);
  if (!payload) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { ...publicUserSelect, passwordHash: true },
  });
  if (!user || !sessionMatchesPassword(payload, user.passwordHash)) return null;
  return { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt };
}

/** For server components that must not render for anonymous visitors. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    const token = (await cookies()).get(SESSION_COOKIE)?.value;
    redirect(verifySessionToken(token) ? "/api/auth/expired" : "/login");
  }
  return user;
}
