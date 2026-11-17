import { authMessages } from "@/i18n/messages/auth";
import { getRequestLocale } from "@/i18n/request";
import { checkSameOrigin } from "@/lib/http/same-origin";
import { readJsonBody } from "@/lib/http/json-body";
import { NextResponse } from "next/server";

import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";

/**
 * POST /api/auth/logout — clears the session cookie.
 * POST-only so a stray link/prefetch cannot sign the user out.
 */
export async function POST(request: Request) {
  const locale = await getRequestLocale();
  const t = authMessages[locale];
  if (!checkSameOrigin(request, process.env)) {
    return NextResponse.json({ error: t.requestBlocked }, { status: 403 });
  }
  const body = await readJsonBody(request);
  if (!body.ok && body.reason === "too_large") {
    return NextResponse.json({ error: t.bodyTooLarge }, { status: 413 });
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", {
    ...sessionCookieOptions(request.url),
    maxAge: 0,
  });
  return response;
}
