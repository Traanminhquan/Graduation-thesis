/** Offline checks: npx tsx scripts/check-listening-audio.ts */
import assert from "node:assert/strict";

import { formatClock, recordedAudioPath } from "../src/lib/listening/audio";

function check(name: string, run: () => void) {
  try {
    run();
    console.log(`ok ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`, error);
    process.exitCode = 1;
  }
}

check("recorded audio paths", () => {
  const valid = "/audio/listening/Lesson_01-a.mp3";
  assert.equal(recordedAudioPath(valid), valid);
  for (const value of [
    "tts://browser-speech-synthesis/lesson-1",
    "/audio/listening/../x.mp3",
    "https://example.com/audio/listening/x.mp3",
    "/audio/listening/x.wav",
    "/other/x.mp3",
    "/audio/listening/x.mp3?download=1",
    "/audio/listening/x.mp3\n",
    "/audio/listening/.mp3",
    "",
    null,
    undefined,
  ]) {
    assert.equal(recordedAudioPath(value), null, String(value));
  }
});

check("clock formatting", () => {
  for (const [input, expected] of [
    [0, "0:00"],
    [65_400, "1:05"],
    [999, "0:00"],
    [60_000, "1:00"],
    [3_661_000, "61:01"],
    [-1000, "0:00"],
    [NaN, "0:00"],
    [Infinity, "0:00"],
  ] as const) {
    assert.equal(formatClock(input), expected);
  }
});
