import { isSpeechSynthesisSupported, splitSentences } from "../listening/speech";

export type SpeakQueueDeps = { synth?: SpeechSynthesis; Utterance?: typeof SpeechSynthesisUtterance };
export interface SpeakQueue {
  push(text: string): void;
  end(): void;
  cancel(): void;
  readonly speaking: boolean;
  onIdle(callback: () => void): void;
}

export function pickEnglishVoice(voices: readonly SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  return voices.find((voice) => voice.localService && /^en-(GB|US)$/i.test(voice.lang))
    ?? voices.find((voice) => /^en-/i.test(voice.lang)) ?? null;
}

export function createSpeakQueue(
  options: { rate?: number; lang?: string; voice?: SpeechSynthesisVoice | null } = {},
  deps: SpeakQueueDeps = {},
): SpeakQueue {
  const synth = deps.synth ?? globalThis.speechSynthesis;
  const Utterance = deps.Utterance ?? globalThis.SpeechSynthesisUtterance;
  const supported = isSpeechSynthesisSupported(synth) && typeof Utterance === "function";
  let buffer = "";
  let queue: string[] = [];
  let current: SpeechSynthesisUtterance | undefined;
  let idle: (() => void) | undefined;
  let notify = false;

  function pump() {
    if (current) return;
    const sentence = queue.shift();
    if (sentence === undefined) {
      // Unfinished streamed text is still work: do not signal idle between chunks.
      if (!buffer.trim() && notify) {
        notify = false;
        idle?.();
      }
      return;
    }
    const utterance = new Utterance(sentence);
    current = utterance;
    utterance.lang = options.lang ?? "en-GB";
    utterance.rate = options.rate ?? 1;
    utterance.voice = options.voice ?? null;
    const finished = () => {
      if (current !== utterance) return;
      current = undefined;
      pump();
    };
    utterance.onend = finished;
    utterance.onerror = finished;
    try { synth.speak(utterance); } catch { finished(); }
  }

  return {
    push(text) {
      if (!supported) return;
      buffer += text;
      // Only whitespace confirms a streaming boundary; punctuation at the end
      // of a chunk might still be the decimal point in the next chunk's number.
      let boundary = 0;
      const ends = /[.!?]+(?=\s)/g;
      for (let match = ends.exec(buffer); match; match = ends.exec(buffer)) {
        boundary = match.index + match[0].length;
      }
      if (boundary) {
        queue.push(...splitSentences(buffer.slice(0, boundary)));
        buffer = buffer.slice(boundary);
        notify = true;
        pump();
      }
    },
    end() {
      if (!supported) { idle?.(); return; }
      queue.push(...splitSentences(buffer));
      buffer = "";
      notify = true;
      pump();
    },
    cancel() {
      current = undefined;
      buffer = "";
      queue = [];
      notify = false;
      if (supported) synth.cancel();
    },
    get speaking() { return current !== undefined; },
    onIdle(callback) { idle = callback; },
  };
}
