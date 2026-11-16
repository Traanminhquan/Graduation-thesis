/** Offline only: synthetic containers, in-memory database/ledger, deny-by-default fetch. */
import assert from "node:assert/strict";
import { inspectAudio } from "../src/lib/speaking/stt/audio";
import { sttConfig, SttError } from "../src/lib/speaking/stt/config";
import { GROQ_URL, GROQ_MODEL, transcribeGroq } from "../src/lib/speaking/stt/groq";
import { fileSttLedger, withSttBudget, type SttLedger, type Usage } from "../src/lib/speaking/stt/budget";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { transcribeSpeaking } from "../src/lib/speaking/transcribe";
import { speakingDraftId, getSpeakingDraft, transcriptSource, type SpeakingDb } from "../src/lib/speaking/draft";
import { confirmSpeakingForUser, submitSpeakingForUser } from "../src/lib/speaking/submit";
import { getSpeakingSubmissionForUser, listSpeakingPrompts } from "../src/lib/speaking/data";
import { checkSameOrigin, handleTranscriptionRequest } from "../src/lib/speaking/stt/http";

const env = { NODE_ENV: "test" as const, SPEAKING_STT_ENABLED: "true", GROQ_API_KEY: "offline-key", SPEAKING_STT_PRICE_PER_HOUR_USD: "0.04" };
const join = (...parts: Uint8Array[]) => new Uint8Array(Buffer.concat(parts));
const str = (s: string) => new Uint8Array(Buffer.from(s));
function mp4(seconds: number) {
  const box = (name: string, body: Uint8Array) => { const b = Buffer.alloc(8); b.writeUInt32BE(body.length + 8); b.write(name, 4); return join(b, body); };
  const header = Buffer.alloc(100); header.writeUInt32BE(1000, 12); header.writeUInt32BE(Math.round(seconds * 1000), 16);
  return join(box("ftyp", str("isom0000")), box("moov", box("mvhd", header)), box("mdat", new Uint8Array([1])));
}
function ogg(seconds: number) {
  const page = (body: Uint8Array, granule: number, seq: number) => { const b = Buffer.alloc(28); b.write("OggS"); b[5] = seq === 0 ? 2 : 4; b.writeBigUInt64LE(BigInt(granule), 6); b.writeUInt32LE(1, 14); b.writeUInt32LE(seq, 18); b[26] = 1; b[27] = body.length; return join(b, body); };
  const head = Buffer.alloc(19); head.write("OpusHead"); head[8] = 1; head[9] = 1;
  return join(page(head, 0, 0), page(new Uint8Array([1]), seconds * 48000, 1));
}
function webm(seconds: number) {
  const el = (id: number[], body: Uint8Array) => join(new Uint8Array(id), new Uint8Array([128 + body.length]), body);
  const tick = Buffer.alloc(2); tick.writeUInt16BE(seconds * 1000 - 20);
  const tracks = el([0x16,0x54,0xae,0x6b], el([0xae], el([0x86], str("A_OPUS"))));
  return join(el([0x1a,0x45,0xdf,0xa3], new Uint8Array()), el([0x18,0x53,0x80,0x67], join(tracks, el([0x1f,0x43,0xb6,0x75], join(el([0xe7], tick), el([0xa3], new Uint8Array([129,0,0,128,1])))))));
}
/**
 * Structure of what Chrome's MediaRecorder really writes when recording with start(timeslice) (verified against real
 * Chrome output): an unknown-size Segment, UNKNOWN-SIZE CLUSTERS (each runs until the next Cluster or the end), no
 * Duration in Info. `badBlock` makes a block carry an unknown size, which must be refused.
 */
function webmLive(seconds: number, badBlock = false, laced = false) {
  const unknown = new Uint8Array([0x01, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]);
  const el = (id: number[], body: Uint8Array) => join(new Uint8Array(id), new Uint8Array([128 + body.length]), body);
  const live = (id: number[], body: Uint8Array) => join(new Uint8Array(id), unknown, body);
  const uint = (n: number) => { const bytes: number[] = []; do { bytes.unshift(n & 255); n = Math.floor(n / 256); } while (n > 0); return new Uint8Array(bytes); };
  const block = (relative: number) => { const t = Buffer.alloc(2); t.writeInt16BE(relative); return el([0xa3], join(new Uint8Array([129]), t, new Uint8Array([laced ? 128 | 2 : 128, 0xfc, 1, 2, 3, 4, 5, 6, 7]))); };
  const tracks = el([0x16, 0x54, 0xae, 0x6b], el([0xae], join(el([0xd7], uint(1)), el([0x86], str("A_OPUS")))));
  const info = el([0x15, 0x49, 0xa9, 0x66], el([0x2a, 0xd7, 0xb1], uint(1000000)));
  const first = live([0x1f, 0x43, 0xb6, 0x75], join(el([0xe7], uint(0)), block(0), block(20), badBlock ? join(new Uint8Array([0xa3]), unknown) : new Uint8Array()));
  const last = live([0x1f, 0x43, 0xb6, 0x75], join(el([0xe7], uint(seconds * 1000 - 20)), block(0)));
  return join(el([0x1a, 0x45, 0xdf, 0xa3], new Uint8Array()), live([0x18, 0x53, 0x80, 0x67], join(info, tracks, first, last)));
}
let calls = 0;
let reply: unknown = { text: "This is the raw transcript.", segments: [{ no_speech_prob: 0.1 }] };
let http = 200;
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  assert.equal(url, GROQ_URL); assert.equal(new URL(String(url)).host, "api.groq.com");
  assert.equal(init?.redirect, "error");
  assert.deepEqual(init?.headers, { Authorization: `Bearer ${env.GROQ_API_KEY}` });
  assert.ok(init?.body instanceof FormData);
  assert.equal(init.body.get("model"), GROQ_MODEL); assert.equal(init.body.get("language"), "en");
  assert.equal(init.body.get("temperature"), "0"); assert.equal(init.body.get("response_format"), "verbose_json");
  for (const [key, value] of init.body) assert.ok(!String(value).includes(env.GROQ_API_KEY), key);
  calls++;
  return Response.json(reply, { status: http });
};
function ledger(initial: Usage[] = []) {
  const rows = [...initial]; let locked = false;
  const store: SttLedger = { read: async () => rows, spend: async since => rows.filter(r => !since || new Date(r.ts) >= since).reduce((sum, r) => sum + r.costUsd, 0), count: async (id, since) => rows.filter(r => r.userId === id && r.status === "reserved" && new Date(r.ts) >= since).length, append: async r => { rows.push(r); }, exclusive: async work => { assert.equal(locked, false); locked = true; try { return await work(store); } finally { locked = false; } } };
  return { rows, store };
}
type Row = { id: string; userId: string; promptId: string; status: string; rawTranscript: string | null; confirmedTranscript: string | null; audioDurationMs: number; updatedAt: Date };
const rows: Row[] = [];
let serial = 0;
const matches = (r: Row, where: Record<string, unknown>) => Object.entries(where).every(([k,v]) => k === "status" && typeof v === "object" && v !== null && "not" in v ? r.status !== v.not : k === "updatedAt" ? r.updatedAt === v : r[k as keyof Row] === v);
const fake = {
  speakingPrompt: {
    findUnique: async ({ where }: { where: { id: string } }) => where.id === "p" ? { speakingSeconds: 60 } : where.id === "p120" ? { speakingSeconds: 120 } : null,
    findMany: async () => [{ id: "p", title: "Prompt", promptText: "Speak", difficulty: "BEGINNER", topic: null, preparationSeconds: 0, speakingSeconds: 60 }],
  },
  speakingSubmission: {
    findFirst: async ({ where }: { where: Record<string, unknown> }) => rows.find(r => matches(r, where)) ?? null,
    findMany: async ({ where }: { where: Record<string, unknown> }) => rows.filter(r => matches(r, where)),
    create: async ({ data }: { data: Partial<Row> }) => { const row = { id: `s${++serial}`, updatedAt: new Date(), ...data } as Row; rows.push(row); return row; },
    updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Partial<Row> }) => { const found = rows.filter(r => matches(r, where)); found.forEach(r => Object.assign(r, data, { updatedAt: new Date() })); return { count: found.length }; },
    deleteMany: async ({ where }: { where: Record<string, unknown> }) => { let count = 0; for (let i = rows.length - 1; i >= 0; i--) if (matches(rows[i], where)) { rows.splice(i, 1); count++; } return { count }; },
  },
  $transaction: async <T>(work: (db: unknown) => Promise<T>) => { const before = rows.map(r => ({ ...r })); try { return await work(fake); } catch (e) { rows.splice(0, rows.length, ...before); throw e; } },
};
const db = fake as unknown as SpeakingDb;
async function main() {
  for (const make of [webm, webmLive, ogg, mp4]) {
    assert.equal(inspectAudio(make(5)).durationMs, 5000);
    assert.throws(() => inspectAudio(make(5).slice(0, 7)), SttError);
  }
  assert.throws(() => inspectAudio(str("text renamed .webm")), SttError);
  assert.throws(() => inspectAudio(webmLive(5, true)), SttError); // an unknown-size BLOCK is never accepted, only live Segments/Clusters
  assert.throws(() => inspectAudio(webmLive(5, false, true)), SttError); // laced blocks would hide packet boundaries: refused
  assert.equal(inspectAudio(webmLive(120)).durationMs, 120000);
  assert.throws(() => inspectAudio(mp4(0)), SttError);
  assert.notEqual(speakingDraftId("a_b", "c"), speakingDraftId("a", "b_c"));
  // Optional settings left blank, as in a copied .env.example, fall back to the defaults.
  assert.deepEqual(
    sttConfig({ ...env, SPEAKING_STT_MIN_BILLED_SECONDS: "", SPEAKING_STT_MAX_SECONDS: " ", SPEAKING_STT_MAX_BYTES: "", SPEAKING_STT_DAILY_CAP: "", SPEAKING_STT_REQUEST_CAP_USD: "", SPEAKING_STT_PILOT_CAP_USD: "" }),
    sttConfig({ ...env, SPEAKING_STT_MIN_BILLED_SECONDS: undefined, SPEAKING_STT_MAX_SECONDS: undefined, SPEAKING_STT_MAX_BYTES: undefined, SPEAKING_STT_DAILY_CAP: undefined, SPEAKING_STT_REQUEST_CAP_USD: undefined, SPEAKING_STT_PILOT_CAP_USD: undefined }),
  );
  for (const bad of [{ GROQ_API_KEY: "" }, { SPEAKING_STT_PRICE_PER_HOUR_USD: "" }, { SPEAKING_STT_PRICE_PER_HOUR_USD: "-1" }, { SPEAKING_STT_MAX_SECONDS: "121" }]) assert.throws(() => sttConfig({ ...env, ...bad }));
  for (const [name, value] of Object.entries({ SPEAKING_STT_MAX_BYTES: "10485761", SPEAKING_STT_DAILY_CAP: "6", SPEAKING_STT_REQUEST_CAP_USD: "0.02", SPEAKING_STT_PILOT_CAP_USD: "2", SPEAKING_STT_MIN_BILLED_SECONDS: "9" })) assert.throws(() => sttConfig({ ...env, [name]: value }));
  const l = ledger();
  const run = (audio = mp4(5), user = "u", hint: unknown = 5000, customEnv = env) => transcribeSpeaking(user, "p", new Blob([audio]), hint, { db, env: customEnv, ledger: l.store });
  const disabled = { NODE_ENV: "test" as const, SPEAKING_STT_ENABLED: "false", get GROQ_API_KEY(): string { throw new Error("key accessed"); } };
  assert.deepEqual(await transcribeSpeaking("", "", new Blob(), null, { env: disabled, db, ledger: { ...l.store, read: async () => { throw new Error("ledger accessed"); } } }), { ok: false, reason: "disabled" });
  assert.deepEqual(await run(mp4(5), ""), { ok: false, reason: "unauthenticated" });
  assert.equal(calls, 0);
  assert.equal((await run(mp4(5), "u", 5000, { ...env, GROQ_API_KEY: "" })).ok, false);
  assert.equal(l.rows.length, 0); assert.equal(calls, 0);
  for (const audio of [mp4(0.5), mp4(121), mp4(62.5), str("bad"), new Uint8Array(10 * 1024 * 1024 + 1)]) assert.equal((await run(audio)).ok, false);
  assert.equal((await run(mp4(5), "u", 9000)).ok, false);
  assert.equal(calls, 0);
  assert.equal((await run()).ok, true); assert.equal(calls, 1);
  assert.equal((await run()).ok, true); assert.equal(calls, 2); assert.equal(rows.length, 1);
  assert.equal(rows[0].status, "DRAFT"); assert.equal(rows[0].confirmedTranscript, null);
  assert.equal(await getSpeakingSubmissionForUser(rows[0].id, "u", db), null);
  assert.equal(await getSpeakingSubmissionForUser(rows[0].id, "other", db), null);
  assert.equal((await listSpeakingPrompts("u", db))[0].submissionCount, 0);
  assert.equal(await getSpeakingDraft("other", "p", db), null);
  assert.equal((await confirmSpeakingForUser("other", "p", "forged", db)).ok, false);
  assert.equal((await confirmSpeakingForUser("u", "p", "x".repeat(5001), db)).ok, false);
  assert.equal((await confirmSpeakingForUser("u", "p", "   ", db)).ok, false);
  const conflictDb = { ...fake, $transaction: async <T>(work: (tx: unknown) => Promise<T>) => work({ ...fake, speakingSubmission: { ...fake.speakingSubmission, deleteMany: async () => ({ count: 0 }) } }) } as unknown as SpeakingDb;
  assert.equal((await confirmSpeakingForUser("u", "p", "Cannot claim", conflictDb)).ok, false);
  assert.equal(rows.length, 1);
  assert.equal((await confirmSpeakingForUser("u", "p", "Edited transcript.", db)).ok, true);
  assert.equal(rows[0].rawTranscript, "This is the raw transcript."); assert.equal(rows[0].confirmedTranscript, "Edited transcript.");
  assert.equal(transcriptSource(rows[0]), "speech-to-text");
  assert.equal((await confirmSpeakingForUser("u", "p", "second confirmation", db)).ok, false);
  assert.equal((await run()).ok, true);
  assert.equal((await submitSpeakingForUser({ userId: "u", promptId: "p", durationMs: 5000, transcript: "Typed manually." }, db)).ok, true);
  assert.equal(rows.some(r => r.status === "DRAFT"), false); assert.equal(transcriptSource(rows[1]), "manual"); assert.equal(rows[1].rawTranscript, null);
  const prior = calls;
  const rowCount = rows.length;
  for (const [body, status, reason] of [[{},200,"invalid_response"], [{text:"",segments:[]},200,"no_speech"], [{text:"Hallucinated words",segments:[{no_speech_prob:0.99}]},200,"no_speech"], [{secret:env.GROQ_API_KEY},429,"rate_limited"], [{},500,"provider_error"]] as const) {
    reply = body; http = status;
    const result = await run(mp4(5), `failure${status}${calls}`);
    assert.deepEqual(result, { ok: false, reason });
    assert.ok(!JSON.stringify(result).includes(env.GROQ_API_KEY));
    assert.equal(rows.length, rowCount);
  }
  assert.equal(calls, prior + 5);
  const before = calls;
  await assert.rejects(() => transcribeGroq(mp4(5), inspectAudio(mp4(5)), env, async () => { throw new Error(env.GROQ_API_KEY); }), (e: unknown) => e instanceof SttError && e.reason === "provider_error" && !e.message.includes(env.GROQ_API_KEY));
  assert.equal(calls, before);
  const originalTimer = globalThis.setTimeout;
  try {
    globalThis.setTimeout = ((callback: (...args: unknown[]) => void) => originalTimer(callback, 1)) as typeof setTimeout;
    let timeoutCalls = 0;
    await assert.rejects(() => transcribeGroq(mp4(5), inspectAudio(mp4(5)), env, async (_url, init) => {
      timeoutCalls++;
      return new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true }));
    }), (e: unknown) => e instanceof SttError && e.reason === "timeout");
    assert.equal(timeoutCalls, 1);
  } finally { globalThis.setTimeout = originalTimer; }
  const originRequest = (origin: string | null, host: string | null = "127.0.0.1:3100", extra: Record<string, string> = {}, url = "http://localhost:3100/api/speaking/transcribe") => {
    const headers = new Headers(extra);
    if (origin !== null) headers.set("origin", origin);
    if (host !== null) headers.set("host", host);
    return new Request(url, { method: "POST", headers, body: "test" });
  };
  const sameOrigin = (origin: string | null, host: string | null = "127.0.0.1:3100", extra: Record<string, string> = {}, customEnv: NodeJS.ProcessEnv = env, url?: string) => checkSameOrigin(originRequest(origin, host, extra, url), customEnv);
  assert.equal(sameOrigin("http://127.0.0.1:3100"), true);
  assert.equal(sameOrigin("http://localhost:3100", "localhost:3100"), true);
  for (const origin of ["http://evil.test", "http://127.0.0.1:3101", "null", "not a url", "http://127.0.0.1:3100/", "http://127.0.0.1:3100/path", "http://user:pw@127.0.0.1:3100", "ftp://127.0.0.1:3100", "", "https://127.0.0.1:3100", "http://127.0.0.1:3100?x", "http://127.0.0.1:3100#x"]) assert.equal(sameOrigin(origin), false, origin);
  assert.equal(sameOrigin("https://evil.test", "127.0.0.1:3100", { "x-forwarded-host": "evil.test", "x-forwarded-proto": "https" }), false);
  const trusted = { ...env, SPEAKING_STT_TRUST_FORWARDED_HEADERS: "true" };
  const forwarded = { "x-forwarded-host": "app.example.com, ignored.test", "x-forwarded-proto": "https, http" };
  assert.equal(sameOrigin("https://app.example.com", "internal:3100", forwarded, trusted), true);
  assert.equal(sameOrigin("https://evil.test", "internal:3100", forwarded, trusted), false);
  assert.equal(sameOrigin("http://127.0.0.1:3100", undefined, { "x-forwarded-proto": "invalid" }, trusted), true);
  assert.equal(sameOrigin("http://127.0.0.1:3100", undefined, { "x-forwarded-proto": "HTTPS" }, trusted), true);
  assert.equal(sameOrigin(null), false);
  for (const site of ["cross-site", "same-site", "none", "Same-Origin", "same-origin"]) assert.equal(sameOrigin(null, undefined, { "sec-fetch-site": site }), site === "same-origin");
  for (const host of [null, "", "bad host", "127.0.0.1:3100/path", "user@127.0.0.1:3100", "[invalid]", "example.com:99999", "example.com:123456"]) assert.equal(sameOrigin("http://127.0.0.1:3100", host), false, String(host));
  for (const host of ["example.com", "example.com:443", "EXAMPLE.COM:443"]) assert.equal(sameOrigin("https://example.com", host, {}, env, "https://localhost/api/speaking/transcribe"), true);
  assert.equal(sameOrigin("http://[::1]:3100", "[::1]:3100"), true);
  assert.equal(checkSameOrigin({ url: "invalid URL", headers: new Headers({ origin: "http://127.0.0.1:3100", host: "127.0.0.1:3100" }) } as Request, env), false);
  const makeRequest = (origin = "https://local.test") => {
    const form = new FormData(); form.set("promptId", "p"); form.set("audio", new Blob([ogg(5)], { type: "text/plain" }), "fake.txt"); form.set("durationMs", "5000");
    return new Request("https://localhost/api/speaking/transcribe", { method: "POST", headers: { origin, host: "local.test" }, body: form });
  };
  let sessions = 0;
  const session = async () => { sessions++; return { id: "http-user" }; };
  const beforeOriginCalls = calls, beforeOriginRows = rows.length;
  let ledgerAccesses = 0;
  const blockedLedger = { ...ledger().store, read: async () => { ledgerAccesses++; throw new Error("ledger accessed"); } };
  const rejected = makeRequest("https://evil.test");
  Object.defineProperty(rejected, "body", { get: () => assert.fail("body accessed") });
  const rejectedResponse = await handleTranscriptionRequest(rejected, session, { env, db, ledger: blockedLedger });
  assert.equal(rejectedResponse.status, 403);
  assert.deepEqual(await rejectedResponse.json(), { ok: false, reason: "origin" });
  assert.equal(sessions, 0); assert.equal(calls, beforeOriginCalls); assert.equal(rows.length, beforeOriginRows); assert.equal(ledgerAccesses, 0);
  // The origin check runs before the disabled flag: a foreign origin is refused even while STT is off.
  assert.equal((await handleTranscriptionRequest(makeRequest("https://evil.test"), session, { env: disabled, db })).status, 403);
  assert.equal((await handleTranscriptionRequest(makeRequest(), session, { env: disabled, db })).status, 503);
  assert.equal(sessions, 0);
  assert.equal((await handleTranscriptionRequest(makeRequest(), async () => null, { env, db })).status, 401);
  reply = { text: "Server generated transcript", segments: [{ no_speech_prob: 0.1 }] }; http = 200;
  const httpResult = await handleTranscriptionRequest(makeRequest(), session, { env, db, ledger: ledger().store });
  assert.equal(httpResult.status, 200); assert.equal((await httpResult.json()).transcript, "Server generated transcript");
  const oversized = makeRequest(); oversized.headers.set("content-length", String(11 * 1024 * 1024));
  assert.equal((await handleTranscriptionRequest(oversized, session, { env, db })).status, 413);
  const exactLimit = mp4(5);
  const padded = Buffer.alloc(10 * 1024 * 1024); padded.set(exactLimit);
  padded.writeUInt32BE(padded.length - exactLimit.length, exactLimit.length); padded.write("free", exactLimit.length + 4);
  assert.equal((await transcribeSpeaking("size-user", "p", new Blob([padded]), 5000, { db, env, ledger: ledger().store })).ok, true);
  // One byte over the limit, in an otherwise VALID container, so only the size rule can reject it.
  const oversize = Buffer.alloc(10 * 1024 * 1024 + 1); oversize.set(exactLimit);
  oversize.writeUInt32BE(oversize.length - exactLimit.length, exactLimit.length); oversize.write("free", exactLimit.length + 4);
  assert.equal(inspectAudio(new Uint8Array(oversize)).durationMs, 5000);
  assert.deepEqual(await transcribeSpeaking("size-user", "p", new Blob([oversize]), 5000, { db, env, ledger: ledger().store }), { ok: false, reason: "too_large" });
  assert.equal((await submitSpeakingForUser({ userId: "u", promptId: "p", durationMs: 120001, transcript: "typed" }, db)).ok, false);
  const absent = await transcribeSpeaking("u", "missing", new Blob([mp4(5)]), 5000, { db, env, ledger: ledger().store });
  assert.deepEqual(absent, { ok: false, reason: "invalid_audio" }); // the specific rule, not an accidental crash
  assert.equal((await transcribeSpeaking("duration-user", "p120", new Blob([mp4(120)]), 120000, { db, env, ledger: ledger().store })).ok, true);
  // A take the recorder stopped at the limit can run a little over: 2 s of tolerance, not more (billing uses the real length).
  assert.equal((await transcribeSpeaking("duration-user", "p120", new Blob([webmLive(120.5)]), 120500, { db, env, ledger: ledger().store })).ok, true);
  assert.equal((await transcribeSpeaking("duration-user", "p120", new Blob([mp4(122)]), 122000, { db, env, ledger: ledger().store })).ok, true);
  assert.equal((await transcribeSpeaking("duration-user", "p120", new Blob([mp4(122.001)]), 122001, { db, env, ledger: ledger().store })).ok, false);
  assert.equal((await submitSpeakingForUser({ userId: "m", promptId: "p120", durationMs: 120500, transcript: "typed" }, db)).ok, true);
  assert.equal((await submitSpeakingForUser({ userId: "m", promptId: "p120", durationMs: 122001, transcript: "typed" }, db)).ok, false);
  await assert.rejects(() => withSttBudget("u", 122.5, env, ledger().store, async () => {}), (e: unknown) => e instanceof SttError && e.reason === "invalid_duration");
  const overDaily = ledger();
  for (let i = 0; i < 5; i++) await withSttBudget("cap-user", 5, env, overDaily.store, async () => {});
  await assert.rejects(() => withSttBudget("cap-user", 5, env, overDaily.store, async () => assert.fail("cap allowed work")), (e: unknown) => e instanceof SttError && e.reason === "daily_cap");
  const fixed = new Date("2026-11-06T00:00:00Z");
  const usage: Usage = { ts: fixed.toISOString(), userId: "u", audioSeconds: 10, costUsd: 0.001, status: "reserved" };
  await assert.rejects(() => withSttBudget("u", 5, env, ledger(Array(5).fill(usage)).store, async () => {}, fixed), (e: unknown) => e instanceof SttError && e.reason === "daily_cap");
  await assert.rejects(() => withSttBudget("u", 120, { ...env, SPEAKING_STT_PRICE_PER_HOUR_USD: "1" }, ledger().store, async () => {}), (e: unknown) => e instanceof SttError && e.reason === "request_budget");
  await assert.rejects(() => withSttBudget("u", 5, env, ledger([{ ...usage, userId: "other", costUsd: 1 }]).store, async () => {}), (e: unknown) => e instanceof SttError && e.reason === "pilot_budget");
  const failed = ledger();
  await assert.rejects(() => withSttBudget("u", 5, env, failed.store, async () => { throw new Error("failure"); }));
  assert.equal(failed.rows.length, 1); assert.equal(failed.rows[0].audioSeconds, 5); assert.equal(failed.rows[0].costUsd, 10 * 0.04 / 3600);
  assert.ok(!JSON.stringify(l.rows).includes(env.GROQ_API_KEY)); assert.ok(!JSON.stringify(l.rows).includes("transcript"));
  // The real file ledger: approved fields only, lock released, and it fails CLOSED on a corrupted ledger or a held lock.
  const dir = mkdtempSync(path.join(os.tmpdir(), "stt-ledger-"));
  try {
    const file = path.join(dir, "speaking-stt-usage.jsonl"), lock = path.join(dir, "speaking-stt.lock");
    reply = { text: "File ledger transcript", segments: [{ no_speech_prob: 0.1 }] }; http = 200;
    const real = fileSttLedger(dir);
    assert.equal((await transcribeSpeaking("file-user", "p", new Blob([webmLive(5)]), 5000, { db, env, ledger: real })).ok, true);
    const text = readFileSync(file, "utf8");
    assert.equal(text.trim().split("\n").length, 2); assert.ok(!text.includes(env.GROQ_API_KEY) && !/transcript/i.test(text)); assert.ok(!existsSync(lock));
    const beforeCalls = calls;
    writeFileSync(file, "this is not json\n", { flag: "a" });
    assert.deepEqual(await transcribeSpeaking("file-user", "p", new Blob([mp4(5)]), 5000, { db, env, ledger: real }), { ok: false, reason: "unavailable" });
    assert.equal(calls, beforeCalls); assert.ok(!existsSync(lock));
    rmSync(file); mkdirSync(lock);
    assert.deepEqual(await transcribeSpeaking("file-user", "p", new Blob([mp4(5)]), 5000, { db, env, ledger: real }), { ok: false, reason: "unavailable" });
    assert.equal(calls, beforeCalls); assert.ok(existsSync(lock)); // a busy/stale lock is never removed by us
  } finally { rmSync(dir, { recursive: true, force: true }); }
  // Hostile request bodies never reach the provider.
  const hostile = async (body: BodyInit | null, type?: string) => {
    const headers: Record<string, string> = { origin: "https://local.test", host: "local.test" }; if (type) headers["content-type"] = type;
    return handleTranscriptionRequest(new Request("https://local.test/api/speaking/transcribe", { method: "POST", headers, body }), async () => ({ id: "hostile" }), { env, db, ledger: ledger().store });
  };
  const callsBeforeHostile = calls;
  assert.equal((await hostile("garbage", "multipart/form-data; boundary=x")).status, 400);
  assert.equal((await hostile(null)).status, 400);
  const noAudio = new FormData(); noAudio.set("promptId", "p"); assert.equal((await hostile(noAudio)).status, 400);
  const stringAudio = new FormData(); stringAudio.set("promptId", "p"); stringAudio.set("audio", "not a file"); assert.equal((await hostile(stringAudio)).status, 400);
  const longPrompt = new FormData(); longPrompt.set("promptId", "x".repeat(201)); longPrompt.set("audio", new Blob([mp4(5)])); assert.equal((await hostile(longPrompt)).status, 400);
  assert.equal(calls, callsBeforeHostile);
  console.log("PASS offline Speaking STT checks; no real network or database used");
}
main().catch(() => { console.error("FAIL offline Speaking STT checks"); process.exitCode = 1; }).finally(() => { globalThis.fetch = originalFetch; });
