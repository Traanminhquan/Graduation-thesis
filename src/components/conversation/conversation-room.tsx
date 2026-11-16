"use client";

import { useMessages } from "@/i18n/client";
import { conversationMessages } from "@/i18n/messages/conversation";


import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

import { endConversationAction } from "@/app/[lang]/conversation/actions";
import { ConversationScript, type ScriptLine } from "@/components/conversation/conversation-script";
import { createSpeakQueue, pickEnglishVoice, type SpeakQueue } from "@/lib/conversation/speak-queue";
import {
  createTurnRecorder,
  isTurnRecordingSupported,
  TurnRecorderError,
  type TurnRecorder,
  type TurnRecording,
} from "@/lib/conversation/turn-recorder";
import { alertNotice, buttonPrimary, buttonSecondary, linkInline, readingText } from "@/lib/ui";

type Status = "idle" | "starting" | "listening" | "sending" | "thinking" | "speaking" | "finished";
type Line = { key: string; role: "LEARNER" | "PARTNER"; text: string; pending?: boolean };
type ServerEvent =
  | { type: "transcript"; index: number; text: string }
  | { type: "delta"; text: string }
  | { type: "done"; index: number; text: string; learnerTurns: number; finished: boolean }
  | { type: "error"; reason: string };

const statusLabels = (t: typeof conversationMessages.en): Record<Status, string> => ({
  idle: t.yourTurn,
  starting: t.startingMic,
  listening: t.listening,
  sending: t.sending,
  thinking: t.waiting,
  speaking: t.speaking,
  finished: t.endedStatus,
});

function reasonMessage(reason: string, turnSeconds: number, t: typeof conversationMessages.en): string {
  const messages: Record<string, string> = {
    disabled: t.disabled,
    unauthenticated: t.signIn,
    origin: t.blocked,
    not_found: t.notFound,
    finished: t.ended,
    turn_limit: t.turnLimit,
    busy: t.busy,
    budget: t.budget,
    invalid_audio: t.invalidAudio,
    invalid_duration: t.duration(turnSeconds),
    no_speech: t.noSpeech,
    speech_unavailable: t.speechUnavailable,
    rate_limited: t.rateLimited,
    reply_unavailable: t.replyUnavailable,
    timeout: t.timeout,
    permission: t.permission,
    no_device: t.noDevice,
    unsupported: t.unsupported,
    failed: t.failed,
  };
  return messages[reason] ?? t.error;
}

// Whether the browser can record does not change while the page is open; the
// server assumes it can, so the first render matches and the browser corrects it.
const noSubscription = () => () => {};
const assumeSupported = () => true;

const extensionFor = (mime: string) => (mime.includes("ogg") ? "ogg" : mime.includes("mp4") ? "mp4" : "webm");

export function ConversationRoom({
  sessionId,
  initialTurns,
  partnerName,
  learnerTurns: initialLearnerTurns,
  maxTurns,
  turnSeconds,
}: {
  sessionId: string;
  initialTurns: readonly { index: number; role: "LEARNER" | "PARTNER"; text: string }[];
  partnerName: string;
  learnerTurns: number;
  maxTurns: number;
  turnSeconds: number;
}) {
  const t = useMessages(conversationMessages);
  const [lines, setLines] = useState<Line[]>(() =>
    initialTurns.map((turn) => ({ key: `turn-${turn.index}`, role: turn.role, text: turn.text })),
  );
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [hints, setHints] = useState<string[]>([]);
  const [hintWaiting, setHintWaiting] = useState(false);
  const [hintsUsed, setHintsUsed] = useState(false);
  const hintVersion = useRef(0);
  const hintPending = useRef(false);
  const [learnerTurns, setLearnerTurns] = useState(initialLearnerTurns);
  // The last learner line has no reply yet (a reply failed, or the page was left too early).
  const [replyMissing, setReplyMissing] = useState(initialTurns.at(-1)?.role === "LEARNER");
  const supported = useSyncExternalStore(noSubscription, isTurnRecordingSupported, assumeSupported);

  const recorder = useRef<TurnRecorder | null>(null);
  const queue = useRef<SpeakQueue | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      recorder.current?.release();
      recorder.current = null;
      queue.current?.cancel();
    };
  }, []);

  const speakQueue = useCallback(() => {
    if (!queue.current) {
      const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;
      const voices = synth?.getVoices() ?? [];
      queue.current = createSpeakQueue({ voice: pickEnglishVoice(voices), lang: "en-GB" });
    }
    return queue.current;
  }, []);

  const finish = useCallback(() => {
    hintVersion.current += 1;
    setHints([]);
    setStatus("finished");
    recorder.current?.release();
    recorder.current = null;
  }, []);

  const send = useCallback(
    async (recording: TurnRecording | null) => {
      setMessage(null);
      setStatus(recording ? "sending" : "thinking");
      const form = new FormData();
      form.set("sessionId", sessionId);
      if (recording) {
        form.set("audio", recording.blob, `turn.${extensionFor(recording.mimeType)}`);
        form.set("durationMs", String(Math.round(recording.durationMs)));
      }

      let stored = !recording; // without audio the learner line is already stored
      let finished = false;
      const partnerKey = `reply-${Date.now()}`;
      const fail = (reason: string) => {
        if (!mounted.current) return;
        setMessage(reasonMessage(reason, turnSeconds, t));
        setLines((current) => current.filter((line) => line.key !== partnerKey));
        if (stored) setReplyMissing(true);
        setStatus("idle");
      };

      let response: Response;
      try {
        response = await fetch("/api/conversation/turn", { method: "POST", body: form });
      } catch {
        fail("timeout");
        return;
      }
      if (!response.ok || !response.body) {
        let reason = "reply_unavailable";
        try {
          const body = (await response.json()) as { reason?: unknown };
          if (typeof body.reason === "string") reason = body.reason;
        } catch {
          /* keep the generic reason */
        }
        fail(reason);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let failed: string | null = null;
      const handle = (event: ServerEvent) => {
        if (event.type === "transcript") {
          stored = true;
          // The learner turn is stored now; count it even if the reply then fails.
          setLearnerTurns((count) => count + 1);
          setReplyMissing(false);
          setLines((current) => [
            ...current,
            { key: `turn-${event.index}`, role: "LEARNER", text: event.text },
            { key: partnerKey, role: "PARTNER", text: "", pending: true },
          ]);
          setStatus("thinking");
        } else if (event.type === "delta") {
          hintVersion.current += 1;
          setHints([]);
          setReplyMissing(false);
          setLines((current) =>
            current.some((line) => line.key === partnerKey)
              ? current.map((line) => (line.key === partnerKey ? { ...line, text: line.text + event.text } : line))
              : [...current, { key: partnerKey, role: "PARTNER", text: event.text, pending: true }],
          );
          speakQueue().push(event.text);
          setStatus("speaking");
        } else if (event.type === "done") {
          hintVersion.current += 1;
          setHints([]);
          finished = event.finished;
          setLearnerTurns(event.learnerTurns);
          setReplyMissing(false);
          setLines((current) => {
            const final = { key: `turn-${event.index}`, role: "PARTNER" as const, text: event.text };
            return current.some((line) => line.key === partnerKey)
              ? current.map((line) => (line.key === partnerKey ? final : line))
              : [...current, final];
          });
        } else {
          failed = event.reason;
        }
      };

      try {
        while (true) {
          const { value, done } = await reader.read();
          buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
          let newline: number;
          while ((newline = buffer.indexOf("\n")) >= 0) {
            const line = buffer.slice(0, newline).trim();
            buffer = buffer.slice(newline + 1);
            if (line) handle(JSON.parse(line) as ServerEvent);
          }
          if (done) break;
        }
        if (buffer.trim()) handle(JSON.parse(buffer) as ServerEvent);
      } catch {
        failed ??= "reply_unavailable";
      }

      if (!mounted.current) return;
      if (failed) {
        queue.current?.cancel();
        fail(failed);
        return;
      }
      const speech = speakQueue();
      speech.onIdle(() => {
        if (!mounted.current) return;
        if (finished) finish();
        else setStatus("idle");
      });
      speech.end();
    },
    [finish, sessionId, speakQueue, turnSeconds, t],
  );

  const speak = useCallback(async () => {
    hintVersion.current += 1;
    setHints([]);
    setMessage(null);
    // Talking over the partner stops their voice, as in a real conversation.
    queue.current?.cancel();
    if (!recorder.current) {
      recorder.current = createTurnRecorder({ maxMs: turnSeconds * 1000 });
    }
    setStatus("starting");
    try {
      await recorder.current.start();
    } catch (error) {
      setMessage(reasonMessage(error instanceof TurnRecorderError ? error.reason : "failed", turnSeconds, t));
      setStatus("idle");
      return;
    }
    setStatus("listening");
    try {
      const { recording, reason } = await recorder.current.next();
      if (!mounted.current) return;
      if (reason === "no_speech") {
        setMessage(reasonMessage("no_speech", turnSeconds, t));
        setStatus("idle");
        return;
      }
      await send(recording);
    } catch {
      if (!mounted.current) return;
      setMessage(reasonMessage("failed", turnSeconds, t));
      setStatus("idle");
    }
  }, [send, turnSeconds, t]);

  const replay = useCallback(() => {
    const last = [...lines].reverse().find((line) => line.role === "PARTNER" && !line.pending);
    if (!last) return;
    const speech = speakQueue();
    speech.cancel();
    speech.push(last.text);
    speech.end();
  }, [lines, speakQueue]);

  const requestHint = async () => {
    if (hintPending.current) return;
    hintPending.current = true;
    const version = hintVersion.current;
    setHintWaiting(true);
    setMessage(null);
    try {
      const response = await fetch("/api/conversation/hint", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId }),
      });
      const result = await response.json() as { ok: boolean; hints?: string[]; reason?: string };
      if (!mounted.current) return;
      if (!result.ok && result.reason === "turn_limit") setHintsUsed(true);
      if (version !== hintVersion.current) return;
      if (response.ok && result.ok && Array.isArray(result.hints)) setHints(result.hints);
      else setMessage(result.reason === "turn_limit"
        ? t.hintsUsed
        : reasonMessage(result.reason ?? "reply_unavailable", turnSeconds, t));
    } catch {
      if (mounted.current && version === hintVersion.current) setMessage(reasonMessage("timeout", turnSeconds, t));
    } finally {
      hintPending.current = false;
      if (mounted.current) setHintWaiting(false);
    }
  };

  const busy = status === "starting" || status === "sending" || status === "thinking";
  const ended = status === "finished";
  const canSpeak = supported && !ended && !busy && !replyMissing && status !== "listening" && learnerTurns < maxTurns;

  return (
    <div className="mt-8">
      <ConversationScript
        learnerLabel={t.you}
        partnerName={partnerName}
        lines={lines.map<ScriptLine>((line) => ({ ...line, text: line.text || "…" }))}
      />

      <div className="mt-6 border-t-2 border-ink pt-6">
        <p role="status" aria-live="polite" className="font-display text-xl text-ink">
          {statusLabels(t)[status]}
          {!ended ? <span className="ml-3 text-base text-ink-muted">{t.turnProgress(learnerTurns, maxTurns)}</span> : null}
        </p>

        {hints.length ? <ul className={`${readingText} mt-4 list-disc pl-6`}>
          {hints.map((hint) => <li key={hint}>{hint}</li>)}
        </ul> : null}

        {message ? <p className={`${alertNotice} mt-4`}>{message}</p> : null}
        {!supported ? <p className={`${alertNotice} mt-4`}>{reasonMessage("unsupported", turnSeconds, t)}</p> : null}

        <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-4">
          {ended ? (
            <Link href={`/conversation/${encodeURIComponent(sessionId)}/result`} className={buttonPrimary}>
              {t.seeFeedback}
            </Link>
          ) : status === "listening" ? (
            <button type="button" className={buttonPrimary} onClick={() => recorder.current?.stop()}>
              {t.done}
            </button>
          ) : replyMissing ? (
            <button type="button" className={buttonPrimary} disabled={busy} onClick={() => void send(null)}>
              {t.getReply}
            </button>
          ) : (
            <button type="button" className={buttonPrimary} disabled={!canSpeak} onClick={() => void speak()}>
              {t.speak}
            </button>
          )}

          {!ended && !busy && status !== "listening" ? (
            <button type="button" className={buttonSecondary} onClick={replay}>
              {t.hearAgain}
            </button>
          ) : null}

          {status === "idle" && !replyMissing && !hintsUsed && learnerTurns < maxTurns ? (
            <button type="button" className={linkInline} disabled={hintWaiting} onClick={() => void requestHint()}>
              {t.hint}
            </button>
          ) : null}

          {!ended ? (
            <form action={endConversationAction}>
              <input type="hidden" name="sessionId" value={sessionId} />
              <button type="submit" className={linkInline} disabled={busy || status === "listening"}>
                {t.endConversation}
              </button>
            </form>
          ) : null}
        </div>
      </div>
    </div>
  );
}
