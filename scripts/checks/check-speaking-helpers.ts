/**
 * Unit checks for the Speaking duration and validation helpers.
 * No database, no network, no AI call, no browser: every case is in memory.
 *
 *   npx tsx scripts/checks/check-speaking-helpers.ts
 */
import {
  durationLimitLabel,
  formatClock,
  formatDurationMs,
} from "../../src/lib/speaking/format";
import {
  DEFAULT_SPEAKING_SECONDS,
  MAX_SPEAKING_SECONDS,
  MAX_TRANSCRIPT_CHARACTERS,
  MIN_RECORDING_MS,
  MIN_SPEAKING_SECONDS,
  cleanTranscript,
  clampElapsedMs,
  recordingProgressPercent,
  remainingMs,
  resolveMaxDurationMs,
  resolveMaxDurationSeconds,
  validateRecordingDuration,
  validateSpeakingAttempt,
  validateTranscript,
} from "../../src/lib/speaking/validation";

let failures = 0;
let checks = 0;

function check(label: string, actual: unknown, expected: unknown) {
  checks += 1;
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures += 1;
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${label}${
      ok
        ? ""
        : `\n      got  ${JSON.stringify(actual)}\n      want ${JSON.stringify(expected)}`
    }`,
  );
}

console.log("-- clock formatting (live timer) --");
check("zero", formatClock(0), "0:00");
check("seven seconds", formatClock(7), "0:07");
check("fifty-nine seconds", formatClock(59), "0:59");
check("one minute", formatClock(60), "1:00");
check("ninety seconds", formatClock(90), "1:30");
check("ten minutes", formatClock(600), "10:00");
check("one hour", formatClock(3600), "60:00");
check("past one hour", formatClock(3661), "61:01");
check("fraction floors", formatClock(59.9), "0:59");
check("negative clamps to zero", formatClock(-12), "0:00");
check("NaN clamps to zero", formatClock(Number.NaN), "0:00");
check("Infinity clamps to zero", formatClock(Number.POSITIVE_INFINITY), "0:00");

console.log("-- duration formatting (stored milliseconds) --");
check("zero milliseconds", formatDurationMs(0), "0:00");
check("negative milliseconds", formatDurationMs(-500), "0:00");
check("NaN milliseconds", formatDurationMs(Number.NaN), "0:00");
check("sub-second rounds up", formatDurationMs(500), "0:01");
check("1499 ms rounds down", formatDurationMs(1499), "0:01");
check("1500 ms rounds to two", formatDurationMs(1500), "0:02");
check("7.4 seconds", formatDurationMs(7400), "0:07");
check("exactly one minute", formatDurationMs(60000), "1:00");
check("ninety and a half seconds", formatDurationMs(90500), "1:31");
check("ten minute limit", formatDurationMs(600000), "10:00");

console.log("-- human time labels --");
check("null label", durationLimitLabel(null), "No time limit");
check("zero label", durationLimitLabel(0), "No time limit");
check("negative label", durationLimitLabel(-30), "No time limit");
check("NaN label", durationLimitLabel(Number.NaN), "No time limit");
check("one second", durationLimitLabel(1), "1 second");
check("thirty seconds", durationLimitLabel(30), "30 seconds");
check("fifty-nine seconds", durationLimitLabel(59), "59 seconds");
check("one minute", durationLimitLabel(60), "1 minute");
check("one minute thirty", durationLimitLabel(90), "1 minute 30 seconds");
check("two minutes", durationLimitLabel(120), "2 minutes");
check("two minutes one second", durationLimitLabel(121), "2 minutes 1 second");
check("ten minutes", durationLimitLabel(600), "10 minutes");
check("fraction rounds", durationLimitLabel(90.4), "1 minute 30 seconds");

console.log("-- prompt budget resolution --");
check("null falls back to default", resolveMaxDurationSeconds(null), DEFAULT_SPEAKING_SECONDS);
check("undefined falls back to default", resolveMaxDurationSeconds(undefined), DEFAULT_SPEAKING_SECONDS);
check("NaN falls back to default", resolveMaxDurationSeconds(Number.NaN), DEFAULT_SPEAKING_SECONDS);
check("zero falls back to default", resolveMaxDurationSeconds(0), DEFAULT_SPEAKING_SECONDS);
check("negative falls back to default", resolveMaxDurationSeconds(-90), DEFAULT_SPEAKING_SECONDS);
check("one clamps to minimum", resolveMaxDurationSeconds(1), MIN_SPEAKING_SECONDS);
check("ten clamps to minimum", resolveMaxDurationSeconds(10), MIN_SPEAKING_SECONDS);
check("minimum passes through", resolveMaxDurationSeconds(MIN_SPEAKING_SECONDS), MIN_SPEAKING_SECONDS);
check("forty-five seconds", resolveMaxDurationSeconds(45), 45);
check("fraction rounds down", resolveMaxDurationSeconds(45.4), 45);
check("fraction rounds up", resolveMaxDurationSeconds(45.6), 46);
check("two minutes", resolveMaxDurationSeconds(120), 120);
check("maximum passes through", resolveMaxDurationSeconds(MAX_SPEAKING_SECONDS), MAX_SPEAKING_SECONDS);
check("above maximum clamps", resolveMaxDurationSeconds(601), MAX_SPEAKING_SECONDS);
check("far above maximum clamps", resolveMaxDurationSeconds(9999), MAX_SPEAKING_SECONDS);
check("milliseconds for two minutes", resolveMaxDurationMs(120), 120000);
check("milliseconds for default", resolveMaxDurationMs(null), DEFAULT_SPEAKING_SECONDS * 1000);

console.log("-- elapsed / remaining / progress --");
check("clamp normal", clampElapsedMs(5000, 60000), 5000);
check("clamp at max", clampElapsedMs(60000, 60000), 60000);
check("clamp over max", clampElapsedMs(61000, 60000), 60000);
check("clamp negative", clampElapsedMs(-100, 60000), 0);
check("clamp NaN elapsed", clampElapsedMs(Number.NaN, 60000), 0);
check("clamp NaN max", clampElapsedMs(500, Number.NaN), 0);
check("remaining normal", remainingMs(60000, 15000), 45000);
check("remaining at zero", remainingMs(60000, 60000), 0);
check("remaining past zero", remainingMs(60000, 61000), 0);
check("remaining NaN elapsed", remainingMs(60000, Number.NaN), 60000);
check("remaining NaN max", remainingMs(Number.NaN, 1000), 0);
check("progress zero", recordingProgressPercent(0, 60000), 0);
check("progress half", recordingProgressPercent(30000, 60000), 50);
check("progress full", recordingProgressPercent(60000, 60000), 100);
check("progress over full", recordingProgressPercent(90000, 60000), 100);
check("progress zero max", recordingProgressPercent(1000, 0), 100);
check("progress NaN max", recordingProgressPercent(1000, Number.NaN), 100);
check("progress negative elapsed", recordingProgressPercent(-1000, 60000), 0);

console.log("-- duration validation --");
const maxMs = 120000;
check("missing duration", validateRecordingDuration(undefined, maxMs), {
  ok: false,
  error: "No recording was received. Record your answer before saving.",
});
check("null duration", validateRecordingDuration(null, maxMs), {
  ok: false,
  error: "No recording was received. Record your answer before saving.",
});
check("empty string duration", validateRecordingDuration("", maxMs), {
  ok: false,
  error: "No recording was received. Record your answer before saving.",
});
check("non-numeric string duration", validateRecordingDuration("abc", maxMs), {
  ok: false,
  error: "No recording was received. Record your answer before saving.",
});
check("negative duration", validateRecordingDuration(-1500, maxMs), {
  ok: false,
  error: "No recording was received. Record your answer before saving.",
});
check("zero duration", validateRecordingDuration(0, maxMs), {
  ok: false,
  error: "No recording was received. Record your answer before saving.",
});
check("NaN duration", validateRecordingDuration(Number.NaN, maxMs), {
  ok: false,
  error: "No recording was received. Record your answer before saving.",
});
check("below one second", validateRecordingDuration(MIN_RECORDING_MS - 1, maxMs), {
  ok: false,
  error:
    "That recording is too short to save. Record at least a couple of seconds.",
});
check("exactly one second", validateRecordingDuration(MIN_RECORDING_MS, maxMs), {
  ok: true,
  durationMs: MIN_RECORDING_MS,
});
check("numeric string is accepted", validateRecordingDuration("2500", maxMs), {
  ok: true,
  durationMs: 2500,
});
check("fraction rounds", validateRecordingDuration(2500.6, maxMs), {
  ok: true,
  durationMs: 2501,
});
check("at the limit", validateRecordingDuration(maxMs, maxMs), {
  ok: true,
  durationMs: maxMs,
});
// The product limit is 120 s; a take the recorder stopped at the limit can run a fraction over, so 2 s of tolerance stays.
check("at limit plus tolerance", validateRecordingDuration(maxMs + 2000, maxMs), {
  ok: true,
  durationMs: maxMs + 2000,
});
check("past limit plus tolerance", validateRecordingDuration(maxMs + 2001, maxMs), {
  ok: false,
  error:
    "That recording is longer than the 120-second limit for this prompt.",
});
check("zero limit still enforces hard cap", validateRecordingDuration(999999, 0), {
  ok: false,
  error: "That recording is longer than the 120-second limit for this prompt.",
});

console.log("-- transcript cleaning --");
check("empty transcript", cleanTranscript(""), "");
check("whitespace transcript", cleanTranscript("  \n\t \n "), "");
check("trims outer whitespace", cleanTranscript("  hello  "), "hello");
check("drops trailing spaces per line", cleanTranscript("line   \nnext"), "line\nnext");
check("trims leading indentation", cleanTranscript("  indented"), "indented");
check("CRLF becomes LF", cleanTranscript("a\r\nb"), "a\nb");
check("lone CR becomes LF", cleanTranscript("a\rb"), "a\nb");
check("strips NUL", cleanTranscript("a\u0000b"), "ab");
check("collapses three blank lines", cleanTranscript("a\n\n\n\nb"), "a\n\nb");
check("keeps one blank line", cleanTranscript("a\n\nb"), "a\n\nb");
check("keeps single line breaks", cleanTranscript("a\nb\nc"), "a\nb\nc");

console.log("-- transcript validation --");
check("absent transcript is null", validateTranscript(undefined), {
  ok: true,
  transcript: null,
});
check("null transcript is null", validateTranscript(null), {
  ok: true,
  transcript: null,
});
check("empty transcript is null", validateTranscript(""), {
  ok: true,
  transcript: null,
});
check("whitespace transcript is null", validateTranscript("  \n\t "), {
  ok: true,
  transcript: null,
});
check("non-string transcript", validateTranscript(42), {
  ok: false,
  error: "The notes field was not valid text.",
});
check("plain transcript is cleaned", validateTranscript("  I said hello.  "), {
  ok: true,
  transcript: "I said hello.",
});
check(
  `exactly ${MAX_TRANSCRIPT_CHARACTERS} characters`,
  validateTranscript("a".repeat(MAX_TRANSCRIPT_CHARACTERS)).ok,
  true,
);
check(
  `${MAX_TRANSCRIPT_CHARACTERS + 1} characters rejected`,
  validateTranscript("a".repeat(MAX_TRANSCRIPT_CHARACTERS + 1)),
  {
    ok: false,
    error: `Notes are too long — keep them under ${MAX_TRANSCRIPT_CHARACTERS.toLocaleString(
      "en-GB",
    )} characters.`,
  },
);

console.log("-- combined attempt validation --");
check("missing duration", validateSpeakingAttempt({
  durationMs: undefined,
  transcript: "notes",
  maxMs,
}), {
  ok: false,
  error: "No recording was received. Record your answer before saving.",
});
check("valid without notes", validateSpeakingAttempt({
  durationMs: 5000,
  transcript: "",
  maxMs,
}), {
  ok: true,
  durationMs: 5000,
  transcript: null,
});
check("valid with notes", validateSpeakingAttempt({
  durationMs: "5000",
  transcript: "  I talked about my weekend.  ",
  maxMs,
}), {
  ok: true,
  durationMs: 5000,
  transcript: "I talked about my weekend.",
});
check("too short wins over notes", validateSpeakingAttempt({
  durationMs: 200,
  transcript: "notes",
  maxMs,
}), {
  ok: false,
  error:
    "That recording is too short to save. Record at least a couple of seconds.",
});
check("too long wins over notes", validateSpeakingAttempt({
  durationMs: maxMs + 5000,
  transcript: "notes",
  maxMs,
}), {
  ok: false,
  error:
    "That recording is longer than the 120-second limit for this prompt.",
});
check("invalid notes with valid duration", validateSpeakingAttempt({
  durationMs: 5000,
  transcript: 42,
  maxMs,
}), {
  ok: false,
  error: "The notes field was not valid text.",
});

console.log("");
console.log(`${checks - failures}/${checks} checks passed`);
if (failures > 0) {
  console.error(`${failures} check(s) FAILED`);
  process.exitCode = 1;
}
