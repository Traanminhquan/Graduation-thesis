/**
 * Speech-playback helpers for the Listening player.
 *
 * There are no hosted audio files in this build: the lesson transcript is read
 * aloud by the browser's Web Speech API (`window.speechSynthesis`). These
 * helpers are pure so the rate table and the support check can be unit-tested
 * without a browser.
 */

export const SPEECH_RATES = [0.75, 1, 1.25, 1.5] as const;
export type SpeechRate = (typeof SPEECH_RATES)[number];

export const DEFAULT_SPEECH_RATE: SpeechRate = 1;

export function speechRateLabel(rate: number): string {
  return `${rate}×`;
}

/**
 * `window.speechSynthesis` exists in every modern browser but can be missing in
 * embedded webviews and some test environments. Duck-type it instead of
 * assuming the constructor is available.
 */
export function isSpeechSynthesisSupported(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as { speak?: unknown; cancel?: unknown };
  return (
    typeof candidate.speak === "function" && typeof candidate.cancel === "function"
  );
}

/**
 * Rough spoken length of a transcript at the default rate, for the "about N
 * minutes" hint in the player. 150 words per minute is a typical TTS pace.
 */
export function estimateSpeechSeconds(
  text: string,
  rate: number = DEFAULT_SPEECH_RATE,
): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  if (words === 0) return 0;
  const seconds = (words / 150) * 60;
  return Math.max(1, Math.round(seconds / Math.max(rate, 0.25)));
}

/** "about 1 min" / "about 45 sec" label for the player. */
export function estimateSpeechLabel(text: string, rate: number): string {
  const seconds = estimateSpeechSeconds(text, rate);
  if (seconds < 60) return `about ${seconds} sec`;
  const minutes = Math.round(seconds / 60);
  return `about ${minutes} min`;
}

/**
 * Splits a script into sentences for sentence-by-sentence playback. A sentence
 * ends at . ! or ? followed by a space or the end of the text, so decimals and
 * times such as "9.30" stay whole. No character of the script is dropped.
 */
export function splitSentences(text: string): string[] {
  const normalised = text.replace(/\s+/g, " ").trim();
  if (!normalised) return [];
  const parts = normalised.match(/.+?(?:[.!?]+(?=\s|$)|$)/g) ?? [normalised];
  return parts.map((part) => part.trim()).filter(Boolean);
}
