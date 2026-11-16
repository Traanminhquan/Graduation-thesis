import { INTL_LOCALE, type Locale } from "@/i18n/config";
import { writingMessages } from "@/i18n/messages/writing";
export type Backup = { text: string; baseSavedAt: string | null; consumed?: boolean };
export type DraftState = {
  text: string; savedText: string; savedAt: string | null;
  flight: { id: number; text: string } | null;
  error: "failed" | "conflict" | null;
};
export type DraftEvent = { type: "edit"; text: string } |
  { type: "start"; id: number } |
  { type: "saved"; id: number; savedAt: string | null } |
  { type: "failed"; id: number; conflict?: boolean } |
  { type: "load"; text: string; savedAt: string | null };
export function draftReducer(state: DraftState, event: DraftEvent): DraftState {
  if (event.type === "edit") return { ...state, text: event.text };
  if (event.type === "load") return state.flight ? state : { text: event.text, savedText: event.text, savedAt: event.savedAt, flight: null, error: null };
  if (event.type === "start") return state.flight ? state : { ...state, flight: { id: event.id, text: state.text }, error: null };
  if (!state.flight || state.flight.id !== event.id) return state;
  if (event.type === "failed") return { ...state, flight: null, error: event.conflict ? "conflict" : "failed" };
  return { ...state, savedText: state.flight.text, savedAt: event.savedAt, flight: null, error: null };
}
export function draftLabel(state: DraftState, locale: Locale = "en"): string {
  const t = writingMessages[locale];
  if (state.flight) return t.saving;
  if (state.error === "conflict") return t.savedElsewhere;
  if (state.error) return t.saveFailed;
  if (state.text !== state.savedText) return t.unsaved;
  return state.savedAt ? t.draftSaved(new Date(state.savedAt).toLocaleTimeString(INTL_LOCALE[locale], { hour: "2-digit", minute: "2-digit" })) : t.unsaved;
}
export function resolveRestore(server: { text: string; savedAt: string | null }, local: Backup | null) {
  if (!local || local.consumed || local.text === server.text) return { text: server.text, offered: null };
  return local.baseSavedAt === server.savedAt
    ? { text: local.text, offered: null }
    : { text: server.text, offered: local.text };
}
