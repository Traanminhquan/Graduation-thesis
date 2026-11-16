"use client";

import { listeningMessages } from "@/i18n/messages/listening";
import { useMessages } from "@/i18n/client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import { cn } from "@/lib/cn";
import { formatClock } from "@/lib/listening/audio";
import {
  DEFAULT_SPEECH_RATE,
  SPEECH_RATES,
  isSpeechSynthesisSupported,
  speechRateLabel,
  splitSentences,
  type SpeechRate,
} from "@/lib/listening/speech";
import { alertNotice, buttonSecondary, sheet, skeleton } from "@/lib/ui";

type PlaybackStatus = "idle" | "playing" | "paused";

type ListeningPlayerProps =
  | { kind: "file"; src: string; durationMs: number | null }
  | { kind: "speech"; transcript: string };

export function ListeningPlayer(props: ListeningPlayerProps) {
  return props.kind === "file" ? (
    <FilePlayer key={props.src} src={props.src} durationMs={props.durationMs} />
  ) : (
    <SpeechPlayer transcript={props.transcript} />
  );
}

function FilePlayer({ src, durationMs }: { src: string; durationMs: number | null }) {
  const t = useMessages(listeningMessages);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [status, setStatus] = useState<PlaybackStatus>("idle");
  const [rate, setRate] = useState<SpeechRate>(DEFAULT_SPEECH_RATE);
  const [position, setPosition] = useState(0);
  const [metadataDuration, setMetadataDuration] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const duration = metadataDuration ?? (Number.isFinite(durationMs) ? Math.max(0, durationMs ?? 0) : 0);

  useEffect(() => {
    const audio = audioRef.current;
    return () => audio?.pause();
  }, []);

  async function play() {
    const audio = audioRef.current;
    if (!audio) return;
    try {
      audio.playbackRate = rate;
      await audio.play();
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        setFailed(true);
        setStatus("idle");
      }
    }
  }

  return (
    <div className={cn(sheet, "p-6 sm:p-8")}>
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        hidden
        onDurationChange={(event) => {
          const seconds = event.currentTarget.duration;
          setMetadataDuration(Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : null);
        }}
        onTimeUpdate={(event) => setPosition(event.currentTarget.currentTime * 1000)}
        onPlay={() => setStatus("playing")}
        onPause={(event) => {
          if (!event.currentTarget.ended) setStatus("paused");
        }}
        onEnded={(event) => {
          event.currentTarget.currentTime = 0;
          setPosition(0);
          setStatus("idle");
        }}
        onError={() => { setFailed(true); setStatus("idle"); }}
      />
      {failed ? (
        <div role="alert" className={alertNotice}>
          <p className="font-semibold">{t.playError}</p>
          <p className="mt-1 font-normal">{t.transcriptNotice}</p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-5">
            <button
              type="button"
              onClick={() => status === "playing" ? audioRef.current?.pause() : void play()}
              aria-label={status === "playing" ? t.pause : status === "paused" ? t.resume : t.play}
              aria-pressed={status === "playing"}
              className="grid size-16 shrink-0 place-items-center rounded-full bg-ink text-white transition-colors hover:bg-ink-soft"
            >
              {status === "playing" ? <PauseGlyph /> : <PlayGlyph />}
            </button>
            <div className="min-w-0">
              <p role="status" aria-live="polite" className="font-display text-xl font-semibold text-ink">
                {status === "playing" ? t.playing : status === "paused" ? t.paused : t.ready}
              </p>
              <p className="text-sm text-ink-muted">{t.clock(formatClock(position), formatClock(duration))}</p>
            </div>
          </div>
          <div className="relative mt-6 h-6 flex items-center">
            <div aria-hidden="true" className="pointer-events-none absolute h-1.5 w-full overflow-hidden rounded-full bg-line">
              <div className="h-full bg-ink" style={{ width: `${duration > 0 ? Math.min(position / duration, 1) * 100 : 0}%` }} />
            </div>
            <input
              type="range"
              aria-label={t.position}
              aria-valuetext={t.clock(formatClock(position), formatClock(duration))}
              min={0}
              max={duration}
              step={100}
              value={Math.min(position, duration)}
              disabled={duration <= 0}
              onChange={(event) => {
                const next = Number(event.currentTarget.value);
                if (audioRef.current) audioRef.current.currentTime = next / 1000;
                setPosition(next);
              }}
              className="relative h-6 w-full cursor-pointer appearance-none bg-transparent accent-ink focus-visible:outline-2 focus-visible:outline-ink [&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-ink [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-ink"
            />
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <fieldset className="flex items-center gap-1">
              <legend className="sr-only">{t.speed}</legend>
              {SPEECH_RATES.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    setRate(option);
                    if (audioRef.current) audioRef.current.playbackRate = option;
                  }}
                  aria-pressed={option === rate}
                  className={cn(
                    "min-h-9 rounded-md px-2 text-sm font-semibold transition-colors sm:px-2.5",
                    option === rate ? "bg-marker text-ink" : "text-ink-muted hover:text-ink",
                  )}
                >
                  {speechRateLabel(option)}
                </button>
              ))}
            </fieldset>
            <button type="button" onClick={() => {
              if (audioRef.current) audioRef.current.currentTime = 0;
              setPosition(0);
              void play();
            }} className={buttonSecondary}>
              <ReplayGlyph />
              {t.replay}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * The capability cannot change during a session, but React only re-reads the
 * client snapshot after the store notifies, so notify once when the component
 * subscribes (i.e. right after hydration).
 */
function subscribeToSpeechSupport(onStoreChange: () => void) {
  const id = window.setTimeout(onStoreChange, 0);
  return () => window.clearTimeout(id);
}

function getSpeechSupport(): boolean {
  return isSpeechSynthesisSupported(window.speechSynthesis);
}

/** The server cannot know the browser's capabilities, so it renders `null`. */
function getServerSpeechSupport(): null {
  return null;
}

/**
 * Reads the lesson transcript aloud with the browser's Web Speech API.
 *
 * No audio file and no paid text-to-speech service is involved: `speak`,
 * `pause`, `resume`, `cancel` and `SpeechSynthesisUtterance.rate` provide
 * play / pause / replay / speed control. The transcript stays server-rendered
 * and hidden during the attempt, and is shown on the results page.
 */
function SpeechPlayer({ transcript }: { transcript: string }) {
  const t = useMessages(listeningMessages);
  // Hydration-safe capability check: the server snapshot is null, then the
  // browser snapshot decides whether the controls render or the fallback does.
  const supported = useSyncExternalStore(
    subscribeToSpeechSupport,
    getSpeechSupport,
    getServerSpeechSupport,
  );
  const [status, setStatus] = useState<PlaybackStatus>("idle");
  const [rate, setRate] = useState<SpeechRate>(DEFAULT_SPEECH_RATE);
  const [sentence, setSentence] = useState(0);

  // The script is spoken one sentence at a time. Pausing cancels speech right
  // away (the browser's own pause() keeps talking until its buffer drains) and
  // remembers the sentence, so Resume continues from there.
  const sentences = useMemo(() => splitSentences(transcript), [transcript]);
  const position = useRef(0);
  // Each start/stop bumps this token; callbacks of cancelled utterances carry
  // an old token and are ignored, so they cannot overwrite the new state.
  const token = useRef(0);

  // Stop playback when the learner leaves the lesson (e.g. submits and lands
  // on the result page) so the voice does not continue in the background.
  useEffect(() => {
    return () => {
      token.current += 1;
      if (isSpeechSynthesisSupported(window.speechSynthesis)) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  function speakFrom(index: number, speechRate: SpeechRate) {
    const synthesis = window.speechSynthesis;
    if (!isSpeechSynthesisSupported(synthesis)) return;

    const current = ++token.current;
    synthesis.cancel();
    position.current = index;
    setStatus("playing");

    const speakNext = () => {
      if (token.current !== current) return;
      if (position.current >= sentences.length) {
        position.current = 0;
        setSentence(0);
        setStatus("idle");
        return;
      }
      setSentence(position.current);
      const utterance = new SpeechSynthesisUtterance(sentences[position.current]);
      utterance.lang = "en-US";
      utterance.rate = speechRate;
      utterance.onend = () => {
        if (token.current !== current) return;
        position.current += 1;
        speakNext();
      };
      utterance.onerror = () => {
        if (token.current !== current) return;
        setStatus("idle");
      };
      synthesis.speak(utterance);
    };
    speakNext();
  }

  function pause() {
    token.current += 1;
    window.speechSynthesis.cancel();
    setStatus("paused");
  }

  function togglePlayback() {
    if (status === "playing") {
      pause();
      return;
    }
    // Resume from the sentence that was interrupted, or start from the top.
    speakFrom(status === "paused" ? position.current : 0, rate);
  }

  function replay() {
    speakFrom(0, rate);
  }

  function changeRate(nextRate: SpeechRate) {
    setRate(nextRate);
    // A new rate cannot be applied to speech already in flight, so active
    // playback restarts the current sentence at the new speed.
    if (status === "playing") speakFrom(position.current, nextRate);
  }

  const statusTitle =
    status === "playing" ? t.playing : status === "paused" ? t.paused : t.ready;
  const statusDetail =
    status === "idle"
      ? t.sentences(sentences.length)
      : t.sentence(sentence + 1, sentences.length);
  const playLabel =
    status === "playing" ? t.pause : status === "paused" ? t.resume : t.play;

  return (
    <div className={cn(sheet, "p-6 sm:p-8")}>
      {supported === false ? (
        <div role="alert" className={alertNotice}>
          <p className="font-semibold">{t.unsupported}</p>
          <p className="mt-1 font-normal">
            {t.fallback}
          </p>
        </div>
      ) : null}

      {supported ? (
        <>
          <div className="flex items-center gap-5">
            <button
              type="button"
              onClick={togglePlayback}
              aria-label={playLabel}
              aria-pressed={status === "playing"}
              className="grid size-16 shrink-0 place-items-center rounded-full bg-ink text-white transition-colors hover:bg-ink-soft"
            >
              {status === "playing" ? <PauseGlyph /> : <PlayGlyph />}
            </button>
            <div className="min-w-0">
              <p role="status" aria-live="polite" className="font-display text-xl font-semibold text-ink">
                {statusTitle}
              </p>
              <p className="text-sm text-ink-muted">{statusDetail}</p>
            </div>
          </div>

          {/* One segment per sentence: the script is hidden, so this is the only map of it. */}
          <div aria-hidden="true" className="mt-6 flex gap-1">
            {sentences.map((_, index) => (
              <span
                key={index}
                className={cn(
                  "h-1.5 flex-1 rounded-full transition-colors",
                  status !== "idle" && index < sentence
                    ? "bg-ink"
                    : status !== "idle" && index === sentence
                      ? "bg-marker ring-1 ring-ink"
                      : "bg-line",
                )}
              />
            ))}
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <fieldset className="flex items-center gap-1">
              <legend className="sr-only">{t.speed}</legend>
              {SPEECH_RATES.map((option) => {
                const active = option === rate;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => changeRate(option)}
                    aria-pressed={active}
                    className={cn(
                      "min-h-9 rounded-md px-2 text-sm font-semibold transition-colors sm:px-2.5",
                      active ? "bg-marker text-ink" : "text-ink-muted hover:text-ink",
                    )}
                  >
                    {speechRateLabel(option)}
                  </button>
                );
              })}
            </fieldset>

            <button type="button" onClick={replay} className={buttonSecondary}>
              <ReplayGlyph />
              {t.replay}
            </button>
          </div>
        </>
      ) : supported === null ? (
        <div className={`${skeleton} h-16 w-full`} />
      ) : null}
    </div>
  );
}

function PlayGlyph() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" className="ml-0.5 size-6">
      <path d="M4.5 2.6a1 1 0 0 1 1.5-.87l7 5.4a1 1 0 0 1 0 1.74l-7 5.4a1 1 0 0 1-1.5-.87V2.6Z" />
    </svg>
  );
}

function PauseGlyph() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" className="size-6">
      <rect x="3.4" y="2.6" width="3.4" height="10.8" rx="1" />
      <rect x="9.2" y="2.6" width="3.4" height="10.8" rx="1" />
    </svg>
  );
}

function ReplayGlyph() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="size-3.5"
    >
      <path d="M3 7.6a5 5 0 1 1 1.6 4.3" />
      <path d="M3 3.4v4.2h4.2" />
    </svg>
  );
}
