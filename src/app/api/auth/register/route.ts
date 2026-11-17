import { checkSameOrigin } from "@/lib/http/same-origin";
import { readJsonBody } from "@/lib/http/json-body";
import { authMessages } from "@/i18n/messages/auth";
import { getRequestLocale } from "@/i18n/request";

import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { publicUserSelect } from "@/lib/auth/current-user";
import { hashPassword } from "@/lib/auth/password";
import {
  authRateLimiter,
  clientAddress,
  REGISTER_ADDRESS_RULE,
  tooManyRequests,
} from "@/lib/auth/rate-limit";
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";
import { isPlainObject, validateRegistration } from "@/lib/auth/validation";
import { prisma } from "@/lib/db";

/**
 * POST /api/auth/register — create a user and start a session.
 * Body: { email, password, name }
 */
export async function POST(request: Request) {
  const locale = await getRequestLocale();
  const t = authMessages[locale];
  if (!checkSameOrigin(request, process.env)) {
    return NextResponse.json({ error: t.requestBlocked }, { status: 403 });
  }
  // Checked before any parsing or bcrypt work.
  const addressLimit = authRateLimiter.consume(
    `register:address:${clientAddress(request)}`,
    REGISTER_ADDRESS_RULE,
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

  const parsed = validateRegistration(body, locale);
  if (!parsed.ok) {
    return NextResponse.json({ errors: parsed.errors }, { status: 400 });
  }

  const { email, password, name } = parsed.value;

  try {
    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: { email, name, passwordHash },
      select: publicUserSelect,
    });

    const { token } = createSessionToken({ ...user, passwordHash });
    const response = NextResponse.json({ user }, { status: 201 });
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(request.url));
    return response;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { errors: { email: t.existingEmail } },
        { status: 409 },
      );
    }
    // Message only — never the request body, which contains the password.
    console.error(
      "Registration failed:",
      error instanceof Error ? error.message : "unknown error",
    );
    return NextResponse.json({ error: t.registerFailed }, { status: 500 });
  }
}
