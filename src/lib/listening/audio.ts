export function recordedAudioPath(audioUrl: string | null | undefined): string | null {
  return typeof audioUrl === "string" && /^\/audio\/listening\/[A-Za-z0-9_-]+\.mp3$/.test(audioUrl)
    && audioUrl.endsWith(".mp3")
    ? audioUrl
    : null;
}

export function formatClock(ms: number): string {
  const seconds = Number.isFinite(ms) ? Math.floor(Math.max(0, ms) / 1000) : 0;
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
