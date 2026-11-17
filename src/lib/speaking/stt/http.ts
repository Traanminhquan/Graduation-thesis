import { transcribeSpeaking, type TranscribeDependencies } from "../transcribe";
import { checkSameOrigin } from "../../http/same-origin";
export { checkSameOrigin } from "../../http/same-origin";
export async function handleTranscriptionRequest(request: Request, session: () => Promise<{ id: string } | null>, deps: TranscribeDependencies = {}) {
  const fail = (reason: string, status: number) => Response.json({ ok: false, reason }, { status });
  const env = deps.env ?? process.env;
  if (!checkSameOrigin(request, env)) return fail("origin", 403);
  if (env.SPEAKING_STT_ENABLED !== "true") return fail("disabled", 503);
  try {
    const user = await session();
    if (!user) return fail("unauthenticated", 401);
    const maxBytes = 10 * 1024 * 1024;
    const length = request.headers.get("content-length");
    if (length && (!/^\d+$/.test(length) || Number(length) > maxBytes + 65536)) return fail("too_large", 413);
    // The small multipart envelope allowance does not raise the audio byte ceiling.
    const reader = request.body?.getReader();
    if (!reader) return fail("invalid_audio", 400);
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > maxBytes + 65536 || chunks.length >= 20000) { await reader.cancel(); return fail("too_large", 413); }
      chunks.push(value);
    }
    const form = await new Response(new Blob(chunks as BlobPart[]), { headers: { "content-type": request.headers.get("content-type") ?? "" } }).formData();
    const audio = form.get("audio"), promptId = form.get("promptId");
    if (!(audio instanceof Blob) || typeof promptId !== "string" || !promptId || promptId.length > 200) return fail("invalid_audio", 400);
    const result = await transcribeSpeaking(user.id, promptId, audio, form.get("durationMs"), deps);
    return Response.json(result, { status: result.ok ? 200 : 400 });
  } catch { return fail("unavailable", 400); }
}
