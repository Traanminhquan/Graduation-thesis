import { checkSameOrigin } from "@/lib/http/same-origin";
import { readJsonBody } from "@/lib/http/json-body";
import { authMessages } from "@/i18n/messages/auth";
import { getRequestLocale } from "@/i18n/request";

import { NextResponse } from "next/server";

import { publicUserSelect } from "@/lib/auth/current-user";
import { DUMMY_PASSWORD_HASH, verifyPassword } from "@/lib/auth/password";
import {
  authRateLimiter,
  clientAddress,
  LOGIN_ADDRESS_RULE,
  LOGIN_EMAIL_FAILURE_RULE,
  tooManyRequests,
} from "@/lib/auth/rate-limit";
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";
import { isPlainObject, validateLogin } from "@/lib/auth/validation";
import { prisma } from "@/lib/db";

/**
 * POST /api/auth/login — verify credentials and start a session.
 * Body: { email, password }
 */
export async function POST(request: Request) {
  const locale = await getRequestLocale();
  const t = authMessages[locale];
  if (!checkSameOrigin(request, process.env)) {
    return NextResponse.json({ error: t.requestBlocked }, { status: 403 });
  }
  // Checked before any parsing or bcrypt work.
  const addressLimit = authRateLimiter.consume(
    `login:address:${clientAddress(request)}`,
    LOGIN_ADDRESS_RULE,
  );
  if (!addressLimit.ok) return tooManyRequests(addressLimit, locale);

  const result = await readJsonBody(request);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.reason === "too_large" ? t.bodyTooLarge : t.jsonBody },
      { status: result.reason === "too_large" ? 413 : 400 },
    );
  }
  const body = result.value;

  if (!isPlainObject(body)) {
    return NextResponse.json({ error: t.jsonObject }, { status: 400 });
  }

  const parsed = validateLogin(body, locale);
  if (!parsed.ok) {
    return NextResponse.json({ errors: parsed.errors }, { status: 400 });
  }

  const { email, password } = parsed.value;

  // Failed attempts are counted per email, so guessing one account is capped
  // even when the caller changes address.
  const emailKey = `login:email:${email.slice(0, 254)}`;
  const emailLimit = authRateLimiter.check(emailKey, LOGIN_EMAIL_FAILURE_RULE);
  if (!emailLimit.ok) return tooManyRequests(emailLimit, locale);

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { ...publicUserSelect, passwordHash: true },
    });

    // Always run a bcrypt comparison so unknown emails are not obviously faster.
    const passwordMatches = await verifyPassword(
      password,
      user?.passwordHash ?? DUMMY_PASSWORD_HASH,
    );

    if (!user || !passwordMatches) {
      authRateLimiter.record(emailKey, LOGIN_EMAIL_FAILURE_RULE);
      return NextResponse.json({ error: t.invalidCredentials }, { status: 401 });
    }

    authRateLimiter.reset(emailKey);
    const { token } = createSessionToken(user);
    const response = NextResponse.json({
      user: { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt },
    });
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(request.url));
    return response;
  } catch (error) {
    console.error("Login failed:", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ error: t.loginFailed }, { status: 500 });
  }
}
