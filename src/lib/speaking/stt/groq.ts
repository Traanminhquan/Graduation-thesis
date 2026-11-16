import { SttError, sttConfig } from "./config";
import type { AudioInfo } from "./audio";
export const GROQ_URL = "https://api.groq.com/openai/v1/audio/transcriptions";
export const GROQ_MODEL = "whisper-large-v3-turbo";

export async function transcribeGroq(bytes: Uint8Array, info: AudioInfo, env: NodeJS.ProcessEnv, request: typeof fetch = fetch): Promise<string> {
  sttConfig(env);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const form = new FormData();
    form.set("file", new Blob([new Uint8Array(bytes)], { type: info.mime }), `recording.${info.extension}`);
    form.set("model", GROQ_MODEL); form.set("language", "en");
    form.set("response_format", "verbose_json"); form.set("temperature", "0");
    const response = await request(GROQ_URL, { method: "POST", redirect: "error", headers: { Authorization: `Bearer ${env.GROQ_API_KEY}` }, body: form, signal: controller.signal });
    if (!response.ok) throw new SttError(response.status === 429 ? "rate_limited" : "provider_error");
    const body: unknown = await response.json();
    if (!body || typeof body !== "object" || !("text" in body) || typeof body.text !== "string" || body.text.length > 5000) throw new SttError("invalid_response");
    const text = body.text.trim();
    const segments = "segments" in body ? body.segments : undefined;
    if (!Array.isArray(segments) || segments.length > 10000 || segments.some(s => !s || typeof s !== "object" || typeof s.no_speech_prob !== "number" || !Number.isFinite(s.no_speech_prob) || s.no_speech_prob < 0 || s.no_speech_prob > 1)) throw new SttError("invalid_response");
    if (text.length < 3 || (segments.length > 0 && segments.every(s => s.no_speech_prob >= 0.8))) throw new SttError("no_speech");
    return text;
  } catch (error) {
    if (controller.signal.aborted) throw new SttError("timeout");
    if (error instanceof SttError) throw error;
    throw new SttError(error instanceof SyntaxError ? "invalid_response" : "provider_error");
  } finally { clearTimeout(timer); }
}
