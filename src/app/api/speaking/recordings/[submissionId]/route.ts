import { recordingHandlers } from "@/lib/speaking/recording";

const handlers = recordingHandlers(
  async () => (await import("@/lib/auth/current-user")).getCurrentUser(),
  async () => (await import("@/lib/db")).prisma,
);
export const GET = handlers.GET;
export const DELETE = handlers.DELETE;
