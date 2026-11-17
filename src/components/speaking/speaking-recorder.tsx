"use client";
import { INTL_LOCALE } from "@/i18n/config";

import { useMessages, useLocale } from "@/i18n/client";
import { speakingMessages } from "@/i18n/messages/speaking";

import {
  useActionState,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

import type { SubmitSpeakingState } from "@/app/[lang]/speaking/actions";
import { TranscriptFlow } from "./transcript-flow";
import { cn } from "@/lib/cn";
import { formatClock } from "@/lib/speaking/format";
import {
  MAX_TRANSCRIPT_CHARACTERS,
  clampElapsedMs,
  recordingProgressPercent,
} from "@/lib/speaking/validation";
import { alertError, buttonPrimary, buttonSecondary, field, readingText, sheet } from "@/lib/ui";

/** Browser recorder: in-memory playback, optional server STT and manual fallback. */

type RecorderStatus =
  | "idle"
  | "requesting"
  | "recording"
  | "recorded"
  | "error";

const MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/mp4",
] as const;

type SpeakingRecorderProps = {
  /** Bound server action: (prevState, formData) => state */
  action: (
    previous: SubmitSpeakingState,
    formData: FormData,
  ) => Promise<SubmitSpeakingState>;
  maxDurationMs: number;
  promptId: string;
  sttEnabled: boolean;
  audioStorageEnabled: boolean;
  initialTranscript: string | null;
};

/** Feature test kept in one place so the click path and the copy agree. */
function supportsRecording(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.MediaRecorder !== "undefined" &&
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices?.getUserMedia === "function"
  );
}

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder.isTypeSupported !== "function") return undefined;
  return MIME_CANDIDATES.find((type) => {
    try {
      return MediaRecorder.isTypeSupported(type);
    } catch {
      return false;
    }
  });
}

/** Maps the Permission/MediaRecorder DOMException names onto plain advice. */
function microphoneErrorMessage(error: unknown, t: typeof speakingMessages.en): string {
  const name =
    typeof error === "object" && error !== null && "name" in error
      ? String((error as { name?: unknown }).name)
      : "";

  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return t.microphoneBlocked;
    case "NotFoundError":
    case "OverconstrainedError":
      return t.microphoneMissing;
    case "NotReadableError":
      return t.microphoneBusy;
    case "AbortError":
      return t.microphoneStopped;
    default:
      return t.microphoneStartFailed;
  }
}

export function SpeakingRecorder({
  action,
  maxDurationMs,
  promptId,
  sttEnabled,
  audioStorageEnabled,
  initialTranscript,
}: SpeakingRecorderProps) {
  const t = useMessages(speakingMessages);
  const locale = useLocale();
  const [state, formAction, pending] = useActionState(action, { error: null });

  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState("");
  // Once speech-to-text has produced a transcript, its review box replaces the manual one.
  const [sttReady, setSttReady] = useState(initialTranscript !== null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const stoppedDurationRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  /** Invalidates an in-flight permission prompt after a discard/unmount. */
  const startTokenRef = useRef(0);
  /** Length of the take that produced the current action error (stale-error guard). */
  const [submittedDurationMs, setSubmittedDurationMs] = useState<number | null>(
    null,
  );

  const transcriptId = useId();
  const transcriptCountId = useId();
  const statusId = useId();

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const replaceAudioUrl = useCallback((next: string | null) => {
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    audioUrlRef.current = next;
    setAudioUrl(next);
    if (!next) setAudioBlob(null);
  }, []);

  /** Stops everything live without touching what is already displayed. */
  const teardown = useCallback(() => {
    clearTimer();
    const recorder = recorderRef.current;
    recorderRef.current = null;
    if (recorder) {
      recorder.ondataavailable = null;
      recorder.onstop = null;
      recorder.onerror = null;
      if (recorder.state !== "inactive") {
        try {
          recorder.stop();
        } catch {
          // Already stopping — nothing to do.
        }
      }
    }
    stopStream();
    chunksRef.current = [];
  }, [clearTimer, stopStream]);

  const resetRecording = useCallback(() => {
    startTokenRef.current += 1;
    teardown();
    replaceAudioUrl(null);
    stoppedDurationRef.current = 0;
    setElapsedMs(0);
    setDurationMs(0);
    setError(null);
    setStatus("idle");
  }, [replaceAudioUrl, teardown]);

  /** Stops an active recorder; `onstop` builds the blob and updates the UI. */
  const finishRecording = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") return;

    const elapsed = clampElapsedMs(
      Date.now() - startedAtRef.current,
      maxDurationMs,
    );
    stoppedDurationRef.current = elapsed;
    setElapsedMs(elapsed);
    clearTimer();

    try {
      recorder.stop();
    } catch {
      teardown();
      setError(t.recordingStopFailed);
      setStatus("error");
    }
  }, [clearTimer, maxDurationMs, teardown, t.recordingStopFailed]);

  const startRecording = useCallback(async () => {
    if (!supportsRecording()) {
      setError(
        t.recordingUnsupported,
      );
      setStatus("error");
      return;
    }

    startTokenRef.current += 1;
    const token = startTokenRef.current;

    teardown();
    replaceAudioUrl(null);
    stoppedDurationRef.current = 0;
    setElapsedMs(0);
    setDurationMs(0);
    setError(null);
    setStatus("requesting");

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (permissionError) {
      if (token !== startTokenRef.current) return;
      setError(microphoneErrorMessage(permissionError, t));
      setStatus("error");
      return;
    }

    // The learner discarded or restarted while the permission prompt was open.
    if (token !== startTokenRef.current) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }

    streamRef.current = stream;

    const mimeType = pickMimeType();
    let recorder: MediaRecorder;
    try {
      recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
    } catch {
      try {
        recorder = new MediaRecorder(stream);
      } catch {
        teardown();
        setError(
          t.recorderStartFailed,
        );
        setStatus("error");
        return;
      }
    }

    chunksRef.current = [];

    recorder.ondataavailable = (event: BlobEvent) => {
      if (event.data && event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };

    recorder.onerror = () => {
      clearTimer();
      stopStream();
      recorderRef.current = null;
      chunksRef.current = [];
      setError(t.recordingInterrupted);
      setStatus("error");
    };

    recorder.onstop = () => {
      clearTimer();
      stopStream();
      recorderRef.current = null;

      const measured = stoppedDurationRef.current;
      const chunks = chunksRef.current;
      chunksRef.current = [];

      const blob = new Blob(chunks, {
        type: recorder.mimeType || "audio/webm",
      });

      if (blob.size === 0) {
        setDurationMs(0);
        setElapsedMs(0);
        setError(
          t.recordingEmpty,
        );
        setStatus("error");
        return;
      }

      replaceAudioUrl(URL.createObjectURL(blob));
      setAudioBlob(blob);
      setElapsedMs(measured);
      setDurationMs(measured);
      setStatus("recorded");
    };

    try {
      recorder.start(250);
    } catch {
      teardown();
      setError(t.recordingStartFailed);
      setStatus("error");
      return;
    }

    recorderRef.current = recorder;
    startedAtRef.current = Date.now();
    setStatus("recording");

    timerRef.current = window.setInterval(() => {
      const elapsed = clampElapsedMs(
        Date.now() - startedAtRef.current,
        maxDurationMs,
      );
      setElapsedMs(elapsed);
      if (elapsed >= maxDurationMs) finishRecording();
    }, 200);
  }, [
    t,
    clearTimer,
    finishRecording,
    maxDurationMs,
    replaceAudioUrl,
    stopStream,
    teardown,
  ]);

  // Stop the microphone and release the object URL when the page is left.
  useEffect(() => {
    return () => {
      startTokenRef.current += 1;
      teardown();
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = null;
      }
    };
  }, [teardown]);

  const isRecording = status === "recording";
  const hasRecording = status === "recorded" && durationMs > 0;
  const progress = recordingProgressPercent(elapsedMs, maxDurationMs);
  const maxSeconds = Math.round(maxDurationMs / 1000);
  const canSubmit = hasRecording && !pending && !transcribing && transcript.trim().length > 0;
  // A validation error belongs to the take that was submitted; once the learner
  // re-records for a different length, it no longer applies.
  const actionError =
    state.error !== null && submittedDurationMs === Math.round(durationMs)
      ? state.error
      : null;
  const feedback = error ?? actionError;

  const submitHint = !hasRecording
    ? t.recordYourAnswerFirst
    : !transcript.trim()
      ? t.typeWhatYouSaidToSubmit
      : null;

  return (
    <form
      action={formAction}
      onSubmit={() => {
        setSubmittedDurationMs(Math.round(durationMs));
      }}
    >
      <div className={cn(sheet, "p-6 sm:p-8")}>
        <h2 className="text-xl font-semibold text-ink">{t.recordStep}
      </h2>

        <div className="mt-4 flex items-center gap-5">
          {!isRecording ? (
            <button
              type="button"
              onClick={startRecording}
              disabled={status === "requesting" || transcribing || pending}
              aria-label={hasRecording ? t.recordAgain : t.startRecording}
              className="grid size-16 shrink-0 place-items-center rounded-full bg-pen text-white transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-60"
            >
              <span aria-hidden="true" className="size-5 rounded-full bg-white" />
            </button>
          ) : (
            <button
              type="button"
              onClick={finishRecording}
              aria-label={t.stopRecording}
              className="grid size-16 shrink-0 place-items-center rounded-full bg-ink text-white transition-colors hover:bg-ink-soft"
            >
              <span aria-hidden="true" className="size-5 rounded-sm bg-white" />
            </button>
          )}

          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-baseline justify-between gap-x-3">
              <span
                id={statusId}
                aria-live="polite"
                className={cn("font-display text-xl font-semibold", isRecording ? "text-pen" : "text-ink")}
              >
                {status === "idle" && t.pressToRecord}
                {status === "requesting" && t.waitingForTheMicrophone}
                {status === "recording" && t.recording}
                {status === "recorded" && t.recordedPressToRedo}
                {status === "error" && t.recorderNeedsAttention}
              </span>
              <span className="whitespace-nowrap text-base font-semibold tabular-nums text-ink">
                {formatClock(elapsedMs / 1000)}
                <span className="font-normal text-ink-muted"> / {formatClock(maxSeconds)}</span>
              </span>
            </p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
              <div
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress}
                aria-label={t.recordingTimeUsed}
                className="h-full rounded-full bg-pen transition-[width]"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>

        {audioUrl ? (
          <audio
            controls
            src={audioUrl}
            aria-label={t.playBackYourRecording}
            className="mt-5 w-full"
          >
            {t.playbackUnsupported}</audio>
        ) : null}

        {hasRecording || status === "error" ? (
          <button
            type="button"
            onClick={resetRecording}
            disabled={transcribing || pending}
            className={cn(buttonSecondary, "mt-4")}
          >
            {status === "error" ? t.resetRecorder : t.discardRecording}
          </button>
        ) : null}

      </div>

      <div className={cn(sheet, "mt-4 p-6 sm:p-8")}>
        <h2 className="text-xl font-semibold text-ink">{t.transcriptStep}
      </h2>

        <TranscriptFlow audioStorageEnabled={audioStorageEnabled} promptId={promptId} audio={audioBlob} durationMs={durationMs} sttEnabled={sttEnabled} initialTranscript={initialTranscript} onBusyChange={setTranscribing} onReady={() => setSttReady(true)} />

        <input
          type="hidden"
          name="durationMs"
          value={hasRecording ? String(Math.round(durationMs)) : ""}
        />

        {feedback ? (
          <p role="alert" className={cn(alertError, "mt-4")}>
            {feedback}
          </p>
        ) : null}

        {sttReady ? null : (
          <>
            <div className="mt-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <label htmlFor={transcriptId} className="text-sm font-semibold text-ink">
                  {t.whatYouSaid}</label>
                <p id={transcriptCountId} className="text-sm text-ink-muted">
                  {transcript.length.toLocaleString(INTL_LOCALE[locale])} /{" "}
                  {MAX_TRANSCRIPT_CHARACTERS.toLocaleString(INTL_LOCALE[locale])}
                </p>
              </div>
              <textarea
                id={transcriptId}
                name="transcript"
                value={transcript}
                onChange={(event) => setTranscript(event.target.value)}
                rows={5}
                maxLength={MAX_TRANSCRIPT_CHARACTERS}
                aria-describedby={transcriptCountId}
                placeholder={t.transcriptInstruction}
                className={cn(field, readingText, "mt-1.5 resize-y")}
              />
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
              {submitHint ? <p className="text-sm text-ink-muted">{submitHint}</p> : null}
              <button type="submit" disabled={!canSubmit} className={cn(buttonPrimary, "w-full sm:w-auto")}>
                {pending ? t.savingYourPractice : t.submitTranscript}
              </button>
            </div>
          </>
        )}
      </div>
    </form>
  );
}
