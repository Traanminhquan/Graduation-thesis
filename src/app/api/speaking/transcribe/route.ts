import { handleTranscriptionRequest } from "@/lib/speaking/stt/http";
export async function POST(request: Request) {
  return handleTranscriptionRequest(request, async () => {
    const { getCurrentUser } = await import("@/lib/auth/current-user");
    return getCurrentUser();
  });
}
