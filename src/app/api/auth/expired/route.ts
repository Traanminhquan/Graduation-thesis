import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/current-user";

import { SESSION_COOKIE } from "@/lib/auth/session";

export async function GET() {
  if (await getCurrentUser()) redirect("/profile");
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
