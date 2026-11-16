import { conversationMessages } from "@/i18n/messages/conversation";
import type { Locale } from "@/i18n/config";
import type { ReactNode } from "react";

import { readingText } from "@/lib/ui";

export type ScriptLine = { key: string; role: "LEARNER" | "PARTNER"; text: ReactNode; pending?: boolean };

/**
 * The conversation set as a play script: the speaker's name in the margin and
 * the line in the reading face. Used live on the conversation page and again,
 * marked up, on the result page. No bubbles, no avatars.
 */
export function ConversationScript({ lines, partnerName, learnerLabel = "You" }: { lines: readonly ScriptLine[]; partnerName: string; learnerLabel?: string }) {
  return (
    <ol className="divide-y divide-line">
      {lines.map((line) => (
        <li
          key={line.key}
          className="grid gap-x-6 gap-y-1 py-4 sm:grid-cols-[8rem_minmax(0,1fr)] sm:items-baseline"
        >
          <span className={line.role === "LEARNER" ? "text-sm font-semibold text-ink" : "text-sm text-ink-muted"}>
            {line.role === "LEARNER" ? learnerLabel : partnerName}
          </span>
          <p className={`${readingText} min-w-0 [overflow-wrap:anywhere] ${line.pending ? "text-ink-muted" : ""}`}>
            {line.text}
          </p>
        </li>
      ))}
    </ol>
  );
}

/**
 * A short name for the margin, from the scenario's partner role:
 * "a barista at a cafe" gives "Barista", "a hiring manager interviewing a
 * junior applicant" gives "Hiring manager".
 */
export function partnerName(partnerRole: string, locale: Locale = "en"): string {
  const core = partnerRole
    .replace(/^(a|an|the)\s+/i, "")
    .split(/\s+(?:at|on|in|from|handling|interviewing|proposing|showing|expecting|looking|who|with)\s+/i)[0]
    .trim();
  const name = core || conversationMessages[locale].partner;
  return name.charAt(0).toUpperCase() + name.slice(1);
}
