"use client";

import { useMessages } from "@/i18n/client";
import { speakingMessages } from "@/i18n/messages/speaking";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { alertError, buttonSecondary, linkInline } from "@/lib/ui";

export function RecordingPlayer({ src, durationLabel }: { src: string; durationLabel?: string }) {
  const t = useMessages(speakingMessages);
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  async function remove() {
    if (busy) return;
    setBusy(true); setError(false);
    try {
      const response = await fetch(src, { method: "DELETE" });
      if (!response.ok) throw new Error();
      router.refresh();
    } catch { setError(true); }
    finally { setBusy(false); }
  }
  return <>
    <audio controls preload="none" src={src} className="mt-3 w-full" aria-label={durationLabel} />
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
    <button type="button" className={linkInline} disabled={busy} onClick={() => confirming ? void remove() : setConfirming(true)}>{confirming ? t.deletePermanently : t.deleteRecording}</button>
    {confirming ? <button type="button" className={buttonSecondary} disabled={busy} onClick={() => { setConfirming(false); setError(false); }}>{t.keep}</button> : null}
    </div>
    {error ? <p role="alert" className={`${alertError} mt-3`}>{t.couldNotDeleteTheRecording}
      </p> : null}
  </>;
}
