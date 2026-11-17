/**
 * Turns Listening transcripts into MP3 files.
 *
 * Default engine: Kokoro (open model, runs on this machine, free, no limits).
 * kokoro-js is NOT a project dependency (it pulls in ~300 MB); install it in a
 * separate folder and pass that folder:
 *
 *   mkdir kokoro && cd kokoro && npm init -y && npm i kokoro-js@1.2.1
 *   npx tsx scripts/generate-listening-audio.ts --kokoro-dir <that folder> --ids seed-listening-43
 *   npx tsx scripts/generate-listening-audio.ts --kokoro-dir <that folder> --all
 *   npx tsx scripts/generate-listening-audio.ts --ids seed-listening-1 --dry-run     plan only
 *
 * Optional engine: Groq `canopylabs/orpheus-v1-english` (--engine groq, needs
 * GROQ_API_KEY; the free tier allows 3,600 characters a day, the paid tier costs
 * about $22 per million characters).
 *
 * Reads transcripts and CEFR levels from the database in DATABASE_URL
 * (read-only) and writes public/audio/listening/<id>.mp3 plus an entry in
 * scripts/listening-audio-manifest.json. Existing files are skipped unless
 * --force. Nothing is written to the database.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import type { Mp3Encoder as Mp3EncoderType } from "@breezystack/lamejs";
import { PrismaClient } from "@prisma/client";

const KBPS = 48; // speech, mono
const GAP_MS = 280; // silence between chunks
const EDGE_MS = 250; // silence at the start and the end
const OUT_DIR = path.join("public", "audio", "listening");
const MANIFEST = path.join("scripts", "content", "listening-audio-manifest.json");

/** American and British voices in turn, women and men alternating. */
const KOKORO_VOICES = [
  "af_heart", "bm_george", "bf_emma", "am_michael", "af_bella", "bm_lewis",
  "bf_isabella", "am_fenrir", "af_nicole", "bm_fable", "bf_alice", "am_puck",
] as const;
/** Slower speech for the lowest levels. */
const KOKORO_SPEED: Record<string, number> = { A1: 0.85, A2: 0.92 };
const GROQ_VOICES = ["hannah", "troy", "diana", "austin", "autumn", "daniel"] as const;

type ManifestEntry = { transcriptSha256?: string; durationMs: number; voice: string; engine: string; speed?: number; characters: number; bytes: number };
type Pcm = { samples: Int16Array; sampleRate: number };

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const value = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Sentences packed into chunks under `max` characters; a long sentence is split at commas, then spaces. */
export function chunkTranscript(text: string, max: number): string[] {
  const sentences = text.replace(/\s+/g, " ").trim().match(/[^.!?]+(?:[.!?]+["')\]]*|$)/g) ?? [];
  const pieces: string[] = [];
  for (const raw of sentences.map((s) => s.trim()).filter(Boolean)) {
    if (raw.length <= max) {
      pieces.push(raw);
      continue;
    }
    let rest = raw;
    while (rest.length > max) {
      const window = rest.slice(0, max);
      let cut = Math.max(window.lastIndexOf(", "), window.lastIndexOf("; "), window.lastIndexOf(": "));
      cut = cut > max / 3 ? cut + 1 : window.lastIndexOf(" ");
      pieces.push(rest.slice(0, cut).trim());
      rest = rest.slice(cut).trim();
    }
    if (rest) pieces.push(rest);
  }
  const chunks: string[] = [];
  for (const piece of pieces) {
    const last = chunks[chunks.length - 1];
    if (last && last.length + 1 + piece.length <= max) chunks[chunks.length - 1] = `${last} ${piece}`;
    else chunks.push(piece);
  }
  return chunks;
}

/** Loads an ES module by file path (bypasses CommonJS resolution under tsx). */
async function importFile<T>(file: string): Promise<T> {
  return (await import(pathToFileURL(file).href)) as T;
}

// ---------------------------------------------------------------- Kokoro

type KokoroAudio = { audio: Float32Array; sampling_rate: number };
type KokoroModel = { generate(text: string, options: { voice: string; speed: number }): Promise<KokoroAudio> };

async function loadKokoro(dir: string): Promise<KokoroModel> {
  const pkg = JSON.parse(readFileSync(path.join(dir, "node_modules", "kokoro-js", "package.json"), "utf8")) as {
    exports?: { import?: string; node?: { import?: string } } | Record<string, unknown>;
    module?: string;
  };
  const exportsField = pkg.exports as Record<string, unknown> | undefined;
  const nodeImport = (exportsField?.node as { import?: string } | undefined)?.import;
  const entry = nodeImport ?? (exportsField?.import as string | undefined) ?? pkg.module ?? "dist/kokoro.js";
  const { KokoroTTS } = await importFile<{ KokoroTTS: { from_pretrained(id: string, o: object): Promise<KokoroModel> } }>(
    path.join(dir, "node_modules", "kokoro-js", entry),
  );
  // q8 = onnx/model_quantized.onnx (92 MB), downloaded once into the kokoro folder's cache.
  return KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", { dtype: "q8", device: "cpu" });
}

function toPcm16(audio: Float32Array): Int16Array {
  const out = new Int16Array(audio.length);
  for (let i = 0; i < audio.length; i++) out[i] = Math.max(-32768, Math.min(32767, Math.round(audio[i] * 32767)));
  return out;
}

// ---------------------------------------------------------------- Groq

const GROQ_MODEL = "canopylabs/orpheus-v1-english";
const PAUSE_MS = Number(value("--pause") ?? 7000);
let lastRequest = 0;

function readWav(buffer: Buffer): Pcm {
  if (buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WAVE") {
    throw new Error("provider did not return a WAV file");
  }
  let offset = 12;
  let sampleRate = 0;
  let channels = 0;
  let bits = 0;
  while (offset + 8 <= buffer.length) {
    const id = buffer.toString("ascii", offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const body = offset + 8;
    if (id === "fmt ") {
      channels = buffer.readUInt16LE(body + 2);
      sampleRate = buffer.readUInt32LE(body + 4);
      bits = buffer.readUInt16LE(body + 14);
    } else if (id === "data") {
      if (bits !== 16 || channels !== 1) throw new Error(`unexpected WAV format: ${channels} channel(s), ${bits} bits`);
      const end = Math.min(buffer.length, body + size);
      const bytes = buffer.subarray(body, end - ((end - body) % 2));
      const samples = new Int16Array(bytes.length / 2);
      for (let i = 0; i < samples.length; i++) samples[i] = bytes.readInt16LE(i * 2);
      return { samples, sampleRate };
    }
    offset = body + size + (size % 2);
  }
  throw new Error("WAV file has no data chunk");
}

async function groqSpeak(input: string, voice: string, apiKey: string): Promise<Pcm> {
  let networkFailures = 0;
  for (let attempt = 0; attempt <= 6; attempt++) {
    await sleep(Math.max(0, lastRequest + PAUSE_MS - Date.now()));
    lastRequest = Date.now();
    let response: Response;
    try {
      response = await fetch("https://api.groq.com/openai/v1/audio/speech", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: GROQ_MODEL, input, voice, response_format: "wav" }),
      });
    } catch (error) {
      if (++networkFailures > 1) throw error;
      console.log("  connection failed, trying once more");
      continue;
    }
    if (response.ok) return readWav(Buffer.from(await response.arrayBuffer()));
    const detail = (await response.text()).slice(0, 300);
    // A daily limit will not clear by waiting a minute: stop.
    if (response.status === 429 && !/per day/i.test(detail) && attempt < 6) {
      const wait = Math.min(120, Number(response.headers.get("retry-after")) || 20);
      console.log(`  rate limited, waiting ${wait}s`);
      await sleep(wait * 1000);
      continue;
    }
    throw new Error(`provider answered ${response.status}: ${detail}`);
  }
  throw new Error("still rate limited after six waits");
}

// ---------------------------------------------------------------- MP3

async function encodeMp3(samples: Int16Array, sampleRate: number): Promise<Buffer> {
  // The package's CommonJS entry is a browser IIFE without exports; load the ES module build.
  const { Mp3Encoder } = await importFile<{ Mp3Encoder: typeof Mp3EncoderType }>(
    path.join(process.cwd(), "node_modules", "@breezystack", "lamejs", "dist", "lamejs.js"),
  );
  const encoder = new Mp3Encoder(1, sampleRate, KBPS);
  const parts: Uint8Array[] = [];
  for (let i = 0; i < samples.length; i += 1152) parts.push(encoder.encodeBuffer(samples.subarray(i, i + 1152)));
  parts.push(encoder.flush());
  return Buffer.concat(parts.map((p) => Buffer.from(p)));
}

// ---------------------------------------------------------------- main

async function main() {
  const engine = value("--engine") ?? "kokoro";
  if (engine !== "kokoro" && engine !== "groq") throw new Error("--engine is kokoro or groq");
  const dryRun = flag("--dry-run");
  const force = flag("--force");
  const all = flag("--all");
  const ids = value("--ids")?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];
  if (!all && ids.length === 0) throw new Error("pass --ids id1,id2 or --all");
  const maxChars = engine === "groq" ? 190 : 300;

  const prisma = new PrismaClient();
  const lessons = await prisma.listeningLesson
    .findMany({ where: all ? {} : { id: { in: ids } }, select: { id: true, transcript: true, cefr: true } })
    .finally(() => prisma.$disconnect());
  const number = (id: string) => Number(id.match(/(\d+)$/)?.[1] ?? 0);
  lessons.sort((a, b) => number(a.id) - number(b.id));
  const missing = ids.filter((id) => !lessons.some((l) => l.id === id));
  if (missing.length) throw new Error(`not in the database: ${missing.join(", ")}`);

  const manifest: Record<string, ManifestEntry> = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, "utf8")) : {};
  mkdirSync(OUT_DIR, { recursive: true });

  let kokoro: KokoroModel | null = null;
  let apiKey = "";
  if (!dryRun && engine === "kokoro") {
    const dir = value("--kokoro-dir");
    if (!dir) throw new Error("pass --kokoro-dir <folder where kokoro-js is installed>");
    kokoro = await loadKokoro(path.resolve(dir));
  }
  if (!dryRun && engine === "groq") {
    apiKey = process.env.GROQ_API_KEY?.trim() ?? "";
    if (!apiKey) throw new Error("GROQ_API_KEY is not set");
  }

  let characters = 0;
  for (const lesson of lessons) {
    const file = path.join(OUT_DIR, `${lesson.id}.mp3`);
    const n = number(lesson.id);
    const voice = value("--voice") ?? (engine === "groq" ? GROQ_VOICES[n % GROQ_VOICES.length] : KOKORO_VOICES[n % KOKORO_VOICES.length]);
    const speed = engine === "kokoro" ? KOKORO_SPEED[lesson.cefr ?? ""] ?? 1 : undefined;
    const chunks = chunkTranscript(lesson.transcript, maxChars);
    const chars = chunks.reduce((sum, c) => sum + c.length, 0);
    if (existsSync(file) && !force) {
      console.log(`skip   ${lesson.id} (file exists)`);
      continue;
    }
    console.log(`${dryRun ? "plan  " : "speak "} ${lesson.id} (${lesson.cefr ?? "no level"}): ${chunks.length} chunks, ${chars} characters, ${engine} ${voice}${speed ? ` x${speed}` : ""}`);
    if (dryRun) {
      characters += chars;
      continue;
    }
    const parts: Int16Array[] = [];
    let sampleRate = 0;
    for (const chunk of chunks) {
      let pcm: Pcm;
      if (kokoro) {
        const out = await kokoro.generate(chunk, { voice, speed: speed ?? 1 });
        pcm = { samples: toPcm16(out.audio), sampleRate: out.sampling_rate };
      } else {
        pcm = await groqSpeak(chunk, voice, apiKey);
      }
      if (sampleRate && pcm.sampleRate !== sampleRate) throw new Error("sample rate changed between chunks");
      sampleRate = pcm.sampleRate;
      parts.push(pcm.samples);
    }
    const gap = new Int16Array(Math.round((sampleRate * GAP_MS) / 1000));
    const edge = new Int16Array(Math.round((sampleRate * EDGE_MS) / 1000));
    const joined = [edge, ...parts.flatMap((p, i) => (i === 0 ? [p] : [gap, p])), edge];
    const samples = new Int16Array(joined.reduce((sum, p) => sum + p.length, 0));
    let at = 0;
    for (const p of joined) {
      samples.set(p, at);
      at += p.length;
    }
    const mp3 = await encodeMp3(samples, sampleRate);
    writeFileSync(file, mp3);
    const durationMs = Math.round((samples.length / sampleRate) * 1000);
    manifest[lesson.id] = { transcriptSha256: createHash("sha256").update(lesson.transcript).digest("hex"), durationMs, voice, engine, ...(speed ? { speed } : {}), characters: chars, bytes: mp3.length };
    writeFileSync(MANIFEST, `${JSON.stringify(Object.fromEntries(Object.entries(manifest).sort((a, b) => number(a[0]) - number(b[0]))), null, 2)}\n`);
    characters += chars;
    console.log(`  wrote ${file}: ${(durationMs / 1000).toFixed(1)} s, ${(mp3.length / 1024).toFixed(0)} KB`);
  }
  console.log(`\n${dryRun ? "Would speak" : "Spoke"} ${characters} characters (${engine}).`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
