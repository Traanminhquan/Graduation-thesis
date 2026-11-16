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
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: t.signInName }, { status: 401 });
    const limit = authRateLimiter.consume(`profile:user:${user.id}`, PROFILE_UPDATE_RULE);
    if (!limit.ok) return tooManyRequests(limit, locale);

    let input: unknown;
    try {
      input = await request.json();
    } catch {
      input = null;
    }
    const result = await updateName(user.id, input, { db: prisma }, locale);
    if (!result.ok) return NextResponse.json({ errors: result.errors }, { status: 400 });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: t.nameFailed }, { status: 500 });
  }
}
