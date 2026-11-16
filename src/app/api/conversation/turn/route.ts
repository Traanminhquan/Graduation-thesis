import { handleTurnRequest, productionTurnDeps } from "@/lib/conversation/http";
import { runTurn } from "@/lib/conversation/turn";

export async function POST(request: Request) {
  return handleTurnRequest(request, {
    session: async () => (await import("@/lib/auth/current-user")).getCurrentUser(),
    run: async function* (input, signal) {
      yield* runTurn(input, await productionTurnDeps(signal));
    },
  });
}
