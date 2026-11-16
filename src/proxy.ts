import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE, verifySessionToken } from "./lib/auth/session";

/**
 * Route protection, Next.js 16 `proxy` convention (formerly middleware).
 * Proxy runs on the Node.js runtime by default in Next 16, so the HMAC
 * verification in lib/auth/session is available here.
 *
 * This is the first gate only — pages and route handlers re-check the session
 * themselves rather than trusting the proxy alone.
 */
const PROTECTED_PREFIXES = [
  "/profile",
  "/reading",
  "/listening",
  "/writing",
  "/speaking",
  "/conversation",
  "/progress",
];

const AUTH_PAGES = ["/login", "/register"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = verifySessionToken(token);

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (isProtected && !session) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    return NextResponse.redirect(loginUrl);
  }

  if (session && AUTH_PAGES.includes(pathname)) {
    const profileUrl = request.nextUrl.clone();
    profileUrl.pathname = "/profile";
    profileUrl.search = "";
    return NextResponse.redirect(profileUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Redirected auth prefetches keep their segment header and 404 under /profile.
  // Use matcher `missing`: the proxy cannot see next-router-prefetch (stripped by Next).
  matcher: [
    "/profile/:path*",
    "/reading/:path*",
    "/listening/:path*",
    "/writing/:path*",
    "/speaking/:path*",
    "/conversation/:path*",
    "/progress/:path*",
    { source: "/login", missing: [{ type: "header", key: "next-router-prefetch" }] },
    { source: "/register", missing: [{ type: "header", key: "next-router-prefetch" }] },
  ],
};
