import { NextResponse } from "next/server";

import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";

/**
 * POST /api/auth/logout — clears the session cookie.
 * POST-only so a stray link/prefetch cannot sign the user out.
 */
export async function POST(request: Request) {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", {
    ...sessionCookieOptions(request.url),
    maxAge: 0,
  });
  return response;
}
