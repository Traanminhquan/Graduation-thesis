"use client";

import { useMessages } from "@/i18n/client";
import { speakingMessages } from "@/i18n/messages/speaking";
import { useState, useTransition } from "react";
import { confirmSpeakingTranscript } from "@/app/[lang]/speaking/actions";
import { cn } from "@/lib/cn";
import { buttonPrimary, buttonSecondary, field, readingText } from "@/lib/ui";
// Fixed, user-safe explanations for the reasons the server returns (never provider text).
export function TranscriptFlow({ promptId, audio, durationMs, sttEnabled, audioStorageEnabled, initialTranscript, onBusyChange, onReady }: { promptId: string; audio: Blob | null; durationMs: number; sttEnabled: boolean; audioStorageEnabled: boolean; initialTranscript: string | null; onBusyChange: (busy: boolean) => void; onReady: () => void }) {
  const t = useMessages(speakingMessages);
const REASONS: Record<string, string> = {
  provider_error: t.theSpeechServiceIsUnavailableRightNow,
  invalid_response: t.theSpeechServiceIsUnavailableRightNow,
  unavailable: t.theSpeechServiceIsUnavailableRightNow,
  configuration: t.speechToTextIsNotSetUpOnThisSite,
  request_budget: t.theTranscriptionBudgetHasBeenReached,
  pilot_budget: t.theTranscriptionBudgetHasBeenReached,
  unauthenticated: t.pleaseSignInAgain,
  origin: t.thisRequestWasBlockedReloadThePageAndTryAgain,
  disabled: t.speechToTextIsNotAvailableRightNow,
  daily_cap: t.youHaveReachedTodaySTranscriptionLimit,
  no_speech: t.noSpeechWasDetectedInThisRecording,
  invalid_audio: t.thisRecordingFormatIsNotSupported,
  duration_unverifiable: t.theRecordingLengthCouldNotBeVerified,
  invalid_duration: t.theRecordingLengthIsNotAllowed,
  too_large: t.theRecordingIsTooLarge,
  rate_limited: t.theSpeechServiceIsBusyPleaseTryAgainLater,
  timeout: t.theSpeechServiceTookTooLongPleaseTryAgain,
};
  const [text, setText] = useState(initialTranscript ?? "");
  const [ready, setReady] = useState(initialTranscript !== null);
  const [phase, setPhase] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, startTransition] = useTransition();
  async function transcribe() {
    if (!audio || busy) return;
    let failure = t.transcriptionFailed;
    setBusy(true); onBusyChange(true); setPhase(t.uploading);
    try {
      const form = new FormData();
      form.set("audio", audio); form.set("promptId", promptId); form.set("durationMs", String(durationMs));
      setPhase(t.transcribing);
      const response = await fetch("/api/speaking/transcribe", { method: "POST", body: form });
      const result = await response.json();
      if (!response.ok || !result.ok || typeof result.transcript !== "string") {
        failure = REASONS[typeof result?.reason === "string" ? result.reason : ""] ?? failure;
        throw new Error();
      }
      setText(result.transcript); setReady(true); setPhase(""); onReady();
    } catch { setPhase(t.retryTranscript(failure)); }
    finally { setBusy(false); onBusyChange(false); }
  }
  return <section aria-label={t.speechToText}>
    {sttEnabled ? <button type="button" className={cn(buttonSecondary, "mt-3")} disabled={!audio || busy || pending} onClick={transcribe}>{busy ? phase : t.transcribeRecording}</button> : null}
    {sttEnabled && audioStorageEnabled ? <p className="mt-6 text-sm leading-6 text-ink-muted">{t.yourRecordingIsSavedWithYourAttemptSoYouCanListenToItAgainAndYouCanDeleteItAfterwards}
      </p> : null}
    {phase && !busy ? <p role="status" aria-live="polite" className="mt-3 text-sm text-ink-soft">{phase}</p> : null}
    {ready && <div className="mt-4">
      <label className="block text-sm font-semibold text-ink">{t.checkTheTranscript}<textarea className={cn(field, readingText, "mt-1.5 resize-y font-normal")} rows={6} maxLength={5000} value={text} onChange={e => setText(e.target.value)} />
      </label>
      <button type="button" className={cn(buttonPrimary, "mt-4 w-full sm:w-auto")} disabled={busy || pending || !text.trim()} onClick={() => startTransition(async () => {
        const result = await confirmSpeakingTranscript(promptId, text);
        if (result.error) setPhase(t.failedToConfirmPleaseReviewAndTryAgain);
      })}>{pending ? t.confirming : t.confirmAndSubmit}</button>
    </div>}
  </section>;
}
