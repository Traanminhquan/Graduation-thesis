import { getHint, type HintDeps } from "@/lib/conversation/hint";
import { handleHintRequest } from "@/lib/conversation/hint-http";
import { productionTurnDeps } from "@/lib/conversation/http";

export async function POST(request: Request) {
  return handleHintRequest(request, {
    session: async () => (await import("@/lib/auth/current-user")).getCurrentUser(),
    run: async (input, signal) => getHint(input, await productionTurnDeps(signal) as unknown as HintDeps),
  });
}
