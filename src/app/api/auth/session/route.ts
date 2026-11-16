import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/current-user";

/**
 * GET /api/auth/session — the current user, or null. Used for scripted checks
 * and for client-side UI that needs to know who is signed in.
 */
export async function GET() {
  const user = await getCurrentUser();
  return NextResponse.json(
    { user },
    { headers: { "cache-control": "no-store" } },
  );
}
