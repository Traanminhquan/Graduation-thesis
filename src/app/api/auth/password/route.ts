import { authMessages } from "@/i18n/messages/auth";
import { getRequestLocale } from "@/i18n/request";

import { NextResponse } from "next/server";

import { changePassword } from "@/lib/auth/change-password";
import { getCurrentUser } from "@/lib/auth/current-user";
import { authRateLimiter, PASSWORD_CHANGE_FAILURE_RULE, tooManyRequests } from "@/lib/auth/rate-limit";
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export async function POST(request: Request) {
  const locale = await getRequestLocale();
  const t = authMessages[locale];
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: t.signInPassword }, { status: 401 });
  const key = `password:user:${user.id}`;
  const limit = authRateLimiter.check(key, PASSWORD_CHANGE_FAILURE_RULE);
  if (!limit.ok) return tooManyRequests(limit, locale);

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    input = null;
  }
  try {
    const result = await changePassword(user.id, input, { db: prisma }, locale);
    if (!result.ok) {
      if (result.reason === "fields") return NextResponse.json({ errors: result.errors }, { status: 400 });
      authRateLimiter.record(key, PASSWORD_CHANGE_FAILURE_RULE);
      return NextResponse.json({ errors: { currentPassword: t.wrongPassword } }, { status: 401 });
    }
    authRateLimiter.reset(key);
    const { token } = createSessionToken({ ...user, passwordHash: result.passwordHash });
    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(request.url));
    return response;
  } catch {
    return NextResponse.json({ error: t.passwordFailed }, { status: 500 });
  }
}
