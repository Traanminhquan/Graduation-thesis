"use client";

import { useMessages, useLocale } from "@/i18n/client";
import { writingMessages } from "@/i18n/messages/writing";

import { startTransition, useActionState, useEffect, useId, useMemo, useRef, useState } from "react";

import { saveWritingDraft } from "@/app/[lang]/writing/actions";
import { draftReducer, draftLabel, resolveRestore, type DraftState, type Backup } from "@/lib/writing/draft-state";
import type { SubmitWritingState } from "@/app/[lang]/writing/actions";
import { analyseWriting } from "@/lib/writing/analysis";
import { MAX_WRITING_CHARACTERS } from "@/lib/writing/validation";
import { wordRangeLabel } from "@/lib/writing/format";
import { alertError, buttonPrimary, linkInline, readingText, sheet } from "@/lib/ui";
import { cn } from "@/lib/cn";

type WritingEditorProps = {
  promptId: string;
  initialText: string;
  initialSavedAt: string | null;
  submissionBaseline: string | null;
  backupKey: string;
  /** Bound server action: (prevState, formData) => state */
  action: (
    previous: SubmitWritingState,
    formData: FormData,
  ) => Promise<SubmitWritingState>;
  minWords: number | null;
  maxWords: number | null;
};

export function WritingEditor({
  action,
  promptId, initialText, initialSavedAt, submissionBaseline, backupKey,
  minWords,
  maxWords,
}: WritingEditorProps) {
  const t = useMessages(writingMessages);
  const locale = useLocale();
  const [draft, setDraft] = useState<DraftState>({ text: initialText, savedText: initialText, savedAt: initialSavedAt, flight: null, error: null });
  const current = useRef(draft);
  const serial = useRef(0);
  const submitting = useRef(false);
  const [ready, setReady] = useState(false);
  const [offered, setOffered] = useState<string | null>(null);
  const [remote, setRemote] = useState<{ text: string; savedAt: string | null } | null>(null);
  function dispatch(event: Parameters<typeof draftReducer>[1]) {
    current.current = draftReducer(current.current, event);
    setDraft(current.current);
  }
  function backup(consumed = false) {
    try { localStorage.setItem(backupKey, JSON.stringify({ text: current.current.text, baseSavedAt: current.current.savedAt, consumed })); } catch { /* Storage may be unavailable. */ }
  }
  const [state, formAction, pending] = useActionState(async (previous: SubmitWritingState, data: FormData) => {
    submitting.current = true;
    backup(true);
    try {
      const result = await action(previous, data);
      submitting.current = false;
      // Only a returned error means the text was NOT submitted, so only then may the backup become restorable again.
      // A successful submit redirects and its backup must stay "consumed".
      if (result?.error) backup();
      return result;
    } catch (error) {
      submitting.current = false;
      // Some Next versions surface the post-submit redirect here; that must not revive the backup either.
      const digest = typeof error === "object" && error !== null && "digest" in error ? String((error as { digest: unknown }).digest) : "";
      if (!digest.startsWith("NEXT_REDIRECT")) backup();
      throw error;
    }
  }, { error: null });
  const text = draft.text;
  function setText(value: string) { dispatch({ type: "edit", text: value }); backup(); }
  useEffect(() => {
    let local: Backup | null = null;
    try {
      const value: unknown = JSON.parse(localStorage.getItem(backupKey) ?? "null");
      if (value && typeof value === "object" && "text" in value && typeof value.text === "string" && "baseSavedAt" in value && (value.baseSavedAt === null || typeof value.baseSavedAt === "string")) local = value as Backup;
    } catch { /* An invalid backup cannot replace the server draft. */ }
    const timer = setTimeout(() => {
    const restored = resolveRestore({ text: initialText, savedAt: initialSavedAt }, local);
    dispatch({ type: "edit", text: restored.text });
    setOffered(restored.offered);
    setReady(true);
    }, 0);
    return () => clearTimeout(timer);
  // Restore only when this editor is mounted.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backupKey]);
  async function save() {
    const before = current.current;
    if (before.flight || submitting.current) return;
    const id = ++serial.current;
    dispatch({ type: "start", id });
    try {
      const result = await saveWritingDraft(promptId, before.text, before.savedAt, submissionBaseline);
      if (result.ok) {
        dispatch({ type: "saved", id, savedAt: result.savedAt });
        if (current.current.text === before.text) {
          try { localStorage.removeItem(backupKey); } catch { /* Optional backup. */ }
        } else backup();
      } else {
        dispatch({ type: "failed", id, conflict: result.reason === "conflict" });
        if (result.reason === "conflict") setRemote(result.serverText === undefined ? null : { text: result.serverText, savedAt: result.serverSavedAt ?? null });
      }
    } catch { dispatch({ type: "failed", id }); }
  }
  useEffect(() => {
    if (!ready || pending || draft.flight || draft.error || draft.text === draft.savedText || !draft.text.trim()) return;
    const timer = setTimeout(() => startTransition(() => { void save(); }), 2000);
    return () => clearTimeout(timer);
  // save reads the latest state through current.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, pending, draft]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!submitting.current && (current.current.text !== current.current.savedText || current.current.flight || current.current.error)) { event.preventDefault(); event.returnValue = ""; }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);
  const textareaId = useId();
  const counterId = useId();

  const analysis = useMemo(
    () => analyseWriting(text, { minWords, maxWords }),
    [text, minWords, maxWords],
  );

  const { wordCount, target } = analysis;
  const range = wordRangeLabel(minWords, maxWords);
  const tooLong = text.length > MAX_WRITING_CHARACTERS;
  const canSubmit = !pending && !draft.flight && ready && wordCount > 0 && !tooLong;

  // Bar fills towards the minimum (or the maximum when it is the only bound).
  const goal = minWords ?? maxWords ?? null;
  const progress =
    goal !== null && goal > 0
      ? Math.min(100, Math.round((wordCount / goal) * 100))
      : 0;

  const barTone =
    target.status === "within"
      ? "bg-tick"
      : target.status === "over"
        ? "bg-pen"
        : "bg-ink";

  const statusLine =
    target.status === "under" && target.min !== null
      ? t.under(target.wordsToMinimum)
      : target.status === "over" && target.max !== null
        ? t.over(target.wordsOverMaximum)
        : target.status === "within"
          ? t.inside(t.wordTarget(minWords, maxWords))
          : null;

  const statusTone =
    target.status === "within"
      ? "text-tick"
      : target.status === "over"
        ? "text-pen"
        : "text-ink-muted";

  return (
    <form action={formAction}>
      <div className={sheet}>
        <label htmlFor={textareaId} className="sr-only">{t.yourResponse}</label>

        <textarea
          id={textareaId}
          name="text"
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={14}
          required
          disabled={pending}
          spellCheck
          aria-describedby={counterId}
          placeholder={t.startWritingHere}
          className={cn(readingText, "block w-full resize-y rounded-t-[3px] bg-transparent px-6 py-5 outline-none placeholder:text-ink-muted focus-visible:outline-none disabled:opacity-70 sm:px-8 sm:py-7")}
        />

        <div aria-hidden="true" className="h-1 bg-line">
          <div
            className={cn("h-full transition-[width]", barTone)}
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="space-y-3 px-6 py-4 sm:px-8">
          <div
            id={counterId}
            className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm"
          >
            <p className="text-ink-muted">
              <span className="font-semibold text-ink tabular-nums">{wordCount}</span>
              {range ? <> / {range}</> : null} {t.wordUnit(wordCount)}
            </p>
            {statusLine ? (
              <p className={cn("font-medium", statusTone)}>{statusLine}</p>
            ) : null}
          </div>

          {tooLong ? <p className={alertError}>{t.shortenResponse}
      </p> : null}
          {state.error ? <p role="alert" className={alertError}>{state.error}</p> : null}
          {draft.error === "conflict" && !remote ? <p className="text-sm text-ink-soft">{t.responseConflict}
      </p> : null}

          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-muted">
              <span role="status">{draftLabel(draft, locale)}</span>
              <button type="button" disabled={!ready || pending || !!draft.flight || tooLong || draft.error === "conflict"} onClick={() => startTransition(() => { void save(); })} className={cn(linkInline, "disabled:opacity-50")}>{draft.error === "failed" ? t.retrySave : t.saveDraft}</button>
              {draft.error === "conflict" && remote ? <>
                <button type="button" className={linkInline} onClick={() => { setOffered(current.current.text); dispatch({ type: "load", ...remote }); }}>{t.loadTheSavedVersion}</button>
                <button type="button" className={linkInline} onClick={() => { const mine = current.current.text; dispatch({ type: "load", ...remote }); dispatch({ type: "edit", text: mine }); backup(); startTransition(() => { void save(); }); }}>{t.keepMineAndSaveOverIt}</button>
              </> : null}
              {offered !== null ? <button type="button" className={linkInline} onClick={() => { setText(offered); setOffered(null); }}>{t.useMyUnsavedText}</button> : null}
            </div>
            <button type="submit" disabled={!canSubmit} className={cn(buttonPrimary, "w-full sm:w-auto")}>
              {pending ? t.savingYourResponse : t.submitResponse}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
