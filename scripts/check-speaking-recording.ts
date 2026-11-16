/** Offline recording checks: no database, network or credentials. */
import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";
import { audioStorageConfig, recordingUrl, isRecordingUrl, saveRecording, pruneRecordings, getRecordingForUser, deleteRecordingForUser, recordingHandlers } from "../src/lib/speaking/recording";
import { transcribeSpeaking } from "../src/lib/speaking/transcribe";
import { confirmSpeakingForUser } from "../src/lib/speaking/submit";
import { speakingDraftId } from "../src/lib/speaking/draft";
import type { SttLedger } from "../src/lib/speaking/stt/budget";

type Row = Record<string, unknown> & { id: string; userId: string; submissionId?: string; createdAt: Date; updatedAt: Date };
type Query = { where: Record<string, unknown>; data?: Record<string, unknown>; select?: Record<string, boolean>; skip?: number; orderBy?: unknown };
function fakeDatabase() {
  let recordings: Row[] = [], submissions: Row[] = [], serial = 0;
  let failStorage = false, forbidden = false, modelCalls = 0;
  const matches = (row: Row, where: Record<string, unknown>): boolean => Object.entries(where).every(([key, value]) => {
    if (value && typeof value === "object" && "in" in value) return (value.in as unknown[]).includes(row[key]);
    return row[key] === value;
  });
  const projected = (row: Row | undefined, select?: Record<string, boolean>) => !row ? null : select ? Object.fromEntries(Object.keys(select).map(k => [k, row[k]])) : row;
  const model = {
    upsert: async ({ create, where }: Query & { create: Record<string, unknown> }) => {
      if (failStorage) throw new Error("storage failed");
      const existing = recordings.find(r => matches(r, where));
      if (existing) Object.assign(existing, create);
      else recordings.push({ id: `r${++serial}`, createdAt: new Date(), updatedAt: new Date(), ...create } as Row);
      return { id: "saved" };
    },
    create: async ({ data }: Query) => { recordings.push({ id: `r${++serial}`, createdAt: new Date(), updatedAt: new Date(), ...data } as Row); return { id: "saved" }; },
    findMany: async ({ where, select, skip, orderBy }: Query) => {
      assert.deepEqual(orderBy, [{ createdAt: "desc" }, { id: "desc" }]);
      assert.ok(select && !select.data);
      return recordings.filter(r => matches(r, where)).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id.localeCompare(a.id)).slice(skip).map(r => projected(r, select));
    },
    findFirst: async ({ where, select }: Query) => {
      assert.equal(typeof where.submissionId, "string"); assert.equal(typeof where.userId, "string");
      return projected(recordings.find(r => matches(r, where)), select);
    },
    deleteMany: async ({ where }: Query) => {
      assert.equal(typeof where.userId, "string");
      if (!(where.id && typeof where.id === "object")) assert.equal(typeof where.submissionId, "string");
      const before = recordings.length; recordings = recordings.filter(r => !matches(r, where)); return { count: before - recordings.length };
    },
  };
  const fake = {
    get speakingRecording() { modelCalls++; assert.equal(forbidden, false, "disabled storage accessed the model"); return model; },
    speakingPrompt: { findUnique: async () => ({ speakingSeconds: 60 }) },
    speakingSubmission: {
      findFirst: async ({ where }: Query) => submissions.find(r => matches(r, where)) ?? null,
      create: async ({ data }: Query) => { const row = { id: `s${++serial}`, createdAt: new Date(), updatedAt: new Date(), ...data } as Row; submissions.push(row); return row; },
      updateMany: async ({ where, data }: Query) => { const rows = submissions.filter(r => matches(r, where)); rows.forEach(r => Object.assign(r, data)); return { count: rows.length }; },
      deleteMany: async ({ where }: Query) => {
        const deleted = submissions.filter(r => matches(r, where));
        submissions = submissions.filter(r => !matches(r, where));
        recordings = recordings.filter(r => !deleted.some(s => s.id === r.submissionId));
        return { count: deleted.length };
      },
    },
    $transaction: async <T>(work: (tx: unknown) => Promise<T>) => {
      const beforeR = recordings.map(r => ({ ...r })), beforeS = submissions.map(r => ({ ...r }));
      try { return await work(fake); } catch (error) { recordings = beforeR; submissions = beforeS; throw error; }
    },
  };
  return { db: fake as unknown as PrismaClient, recordings: () => recordings, submissions: () => submissions, fail: () => { failStorage = true; }, forbid: () => { forbidden = true; }, calls: () => modelCalls };
}
function mp4() {
  const box = (name: string, body: Uint8Array) => { const header = Buffer.alloc(8); header.writeUInt32BE(body.length + 8); header.write(name, 4); return Buffer.concat([header, body]); };
  const header = Buffer.alloc(100); header.writeUInt32BE(1000, 12); header.writeUInt32BE(5000, 16);
  return Buffer.concat([box("ftyp", Buffer.from("isom0000")), box("moov", box("mvhd", header)), box("mdat", Buffer.from([1]))]);
}
const env = { NODE_ENV: "test" as const, SPEAKING_STT_ENABLED: "true", SPEAKING_AUDIO_STORAGE_ENABLED: "true", GROQ_API_KEY: "offline", SPEAKING_STT_PRICE_PER_HOUR_USD: "0.04" };
function ledger(): SttLedger {
  const ops = { read: async () => [], spend: async () => 0, count: async () => 0, append: async () => {} };
  return { ...ops, exclusive: async work => work(ops) };
}
const offlineFetch: typeof fetch = async () => Response.json({ text: "A transcript.", segments: [{ no_speech_prob: 0.1 }] });
async function main() {
  for (const flag of [undefined, "", "TRUE", "1", "false"]) assert.equal(audioStorageConfig({ ...env, SPEAKING_AUDIO_STORAGE_ENABLED: flag }).enabled, false);
  for (const max of [undefined, "", " "]) assert.deepEqual(audioStorageConfig({ ...env, SPEAKING_AUDIO_MAX_BYTES: max }), { enabled: true, maxBytes: 3 * 1024 * 1024 });
  assert.deepEqual(audioStorageConfig({ ...env, SPEAKING_AUDIO_MAX_BYTES: "100" }), { enabled: true, maxBytes: 100 });
  for (const max of ["3145729", "0", "-1", "NaN", "Infinity", "invalid"]) assert.equal(audioStorageConfig({ ...env, SPEAKING_AUDIO_MAX_BYTES: max }).enabled, false);
  assert.equal(recordingUrl("a/b ?#\u00e9"), "/api/speaking/recordings/a%2Fb%20%3F%23%C3%A9");
  assert.equal(isRecordingUrl(recordingUrl("s")), true);
  for (const value of [null, undefined, 1, {}, [], "/other", "https://site/api/speaking/recordings/s"]) assert.equal(isRecordingUrl(value), false);
  const pruning = fakeDatabase();
  for (let i = 0; i < 24; i++) {
    const userId = i === 23 ? "other" : "u", submissionId = `s${i}`;
    await pruning.db.speakingSubmission.create({ data: { id: submissionId, userId, promptId: "p", audioUrl: recordingUrl(submissionId) } });
    await saveRecording(pruning.db, { userId, submissionId, bytes: new Uint8Array([i]), mime: "audio/mp4", durationMs: 5000 });
    pruning.recordings().at(-1)!.createdAt = new Date(i < 4 ? 0 : i * 1000);
  }
  await pruneRecordings(pruning.db, "u");
  assert.equal(pruning.recordings().filter(r => r.userId === "u").length, 20);
  assert.equal(pruning.recordings().filter(r => r.userId === "other").length, 1);
  const cleared = pruning.submissions().filter(r => r.audioUrl === null);
  assert.equal(cleared.length, 3); assert.ok(cleared.every(r => r.userId === "u"));
  assert.deepEqual(cleared.map(r => r.id).sort(), ["s0", "s1", "s2"]);
  assert.equal(await getRecordingForUser(pruning.db, "s23", "u"), null);
  assert.equal(await deleteRecordingForUser(pruning.db, "s23", "u"), false);
  assert.ok(await getRecordingForUser(pruning.db, "s23", "other"));
  assert.equal(await deleteRecordingForUser(pruning.db, "s23", "other"), true);
  assert.equal(pruning.submissions().find(r => r.id === "s23")!.audioUrl, null);
  const run = (fake: ReturnType<typeof fakeDatabase>, customEnv: NodeJS.ProcessEnv = env) => transcribeSpeaking("u", "p", new Blob([mp4()]), 5000, { env: customEnv, db: fake.db, ledger: ledger(), fetch: offlineFetch });
  const stored = fakeDatabase(); assert.equal((await run(stored)).ok, true);
  assert.equal(stored.recordings().length, 1);
  const original = { ...stored.recordings()[0] };
  assert.equal(original.submissionId, speakingDraftId("u", "p")); assert.equal(original.mime, "audio/mp4"); assert.equal(original.durationMs, 5000);
  assert.deepEqual(original.data, mp4()); assert.equal(stored.submissions()[0].audioUrl, null);
  const confirmed = await confirmSpeakingForUser("u", "p", "Edited transcript.", stored.db, env);
  assert.ok(confirmed.ok);
  assert.equal(stored.recordings().length, 1);
  const copied = stored.recordings()[0];
  for (const key of ["data", "mime", "durationMs", "sizeBytes", "createdAt", "userId"]) assert.deepEqual(copied[key], original[key]);
  assert.equal(copied.submissionId, confirmed.submissionId);
  assert.equal(stored.submissions()[0].audioUrl, recordingUrl(confirmed.submissionId));
  const disabled = fakeDatabase(); disabled.forbid();
  const off = { ...env, SPEAKING_AUDIO_STORAGE_ENABLED: "false" };
  assert.equal((await run(disabled, off)).ok, true);
  assert.equal((await confirmSpeakingForUser("u", "p", "Typed.", disabled.db, off)).ok, true);
  assert.equal(disabled.calls(), 0);
  const oversized = fakeDatabase(); assert.equal((await run(oversized)).ok, true);
  assert.equal((await run(oversized, { ...env, SPEAKING_AUDIO_MAX_BYTES: "1" })).ok, true);
  assert.equal(oversized.recordings().length, 0);
  assert.equal((await confirmSpeakingForUser("u", "p", "Edited.", oversized.db, env)).ok, true);
  assert.equal(oversized.submissions()[0].audioUrl, null);
  const failing = fakeDatabase(); assert.equal((await run(failing)).ok, true); failing.fail();
  assert.deepEqual(await run(failing), { ok: true, transcript: "A transcript.", durationMs: 5000 });
  assert.equal(failing.recordings().length, 0); assert.equal(failing.submissions()[0].rawTranscript, "A transcript.");
  let sessions = 0;
  const handlers = recordingHandlers(async () => { sessions++; return null; }, async () => assert.fail("database accessed"), env);
  const context = { params: Promise.resolve({ submissionId: "unknown" }) };
  const request = (origin: string) => new Request("https://local.test/api/speaking/recordings/unknown", { headers: { host: "local.test", origin } });
  const get = await handlers.GET(request("https://local.test"), context);
  assert.equal(get.status, 404); assert.equal(await get.text(), "");
  sessions = 0;
  assert.equal((await handlers.DELETE(request("https://foreign.test"), context)).status, 403); assert.equal(sessions, 0);
  assert.equal((await handlers.DELETE(request("https://local.test"), context)).status, 401);
  // Existing recordings remain playable and deletable with storage switched off.
  const playback = fakeDatabase();
  await saveRecording(playback.db, { userId: "owner", submissionId: "saved", bytes: new Uint8Array([1, 2, 3]), mime: "audio/ogg", durationMs: 5000 });
  const playbackContext = { params: Promise.resolve({ submissionId: "saved" }) };
  const ownerHandlers = recordingHandlers(async () => ({ id: "owner" }), async () => playback.db, off);
  const played = await ownerHandlers.GET(request("https://local.test"), playbackContext);
  assert.equal(played.status, 200);
  assert.deepEqual(new Uint8Array(await played.arrayBuffer()), new Uint8Array([1, 2, 3]));
  for (const [name, value] of Object.entries({ "content-type": "audio/ogg", "content-length": "3", "cache-control": "private, no-store", "content-disposition": "inline", "x-content-type-options": "nosniff" })) assert.equal(played.headers.get(name), value);
  const foreignHandlers = recordingHandlers(async () => ({ id: "stranger" }), async () => playback.db, off);
  assert.equal((await foreignHandlers.GET(request("https://local.test"), playbackContext)).status, 404);
  playback.recordings()[0].mime = "text/html";
  assert.equal((await ownerHandlers.GET(request("https://local.test"), playbackContext)).status, 404);
  assert.equal((await ownerHandlers.DELETE(request("https://local.test"), playbackContext)).status, 200);
  assert.equal((await ownerHandlers.DELETE(request("https://local.test"), playbackContext)).status, 404);
  console.log("PASS offline Speaking recording checks; no network or database used");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
