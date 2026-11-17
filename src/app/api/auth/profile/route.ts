import { checkSameOrigin } from "@/lib/http/same-origin";
import { readJsonBody } from "@/lib/http/json-body";
import { authMessages } from "@/i18n/messages/auth";
import { getRequestLocale } from "@/i18n/request";

import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/current-user";
import { authRateLimiter, PROFILE_UPDATE_RULE, tooManyRequests } from "@/lib/auth/rate-limit";
import { updateName } from "@/lib/auth/update-name";
import { prisma } from "@/lib/db";

export async function POST(request: Request) {
  const locale = await getRequestLocale();
  const t = authMessages[locale];
  if (!checkSameOrigin(request, process.env)) {
    return NextResponse.json({ error: t.requestBlocked }, { status: 403 });
  }
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: t.signInName }, { status: 401 });
    const limit = authRateLimiter.consume(`profile:user:${user.id}`, PROFILE_UPDATE_RULE);
    if (!limit.ok) return tooManyRequests(limit, locale);

    const body = await readJsonBody(request);
    if (!body.ok && body.reason === "too_large") {
      return NextResponse.json({ error: t.bodyTooLarge }, { status: 413 });
    }
    const input = body.ok ? body.value : null;
    const result = await updateName(user.id, input, { db: prisma }, locale);
    if (!result.ok) return NextResponse.json({ errors: result.errors }, { status: 400 });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: t.nameFailed }, { status: 500 });
  }
}
