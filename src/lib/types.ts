/**
 * Shared, UI-level types for the app shell.
 *
 * Database shapes live in `prisma/schema.prisma` and are deliberately NOT
 * duplicated here. Only presentation concerns belong in this file.
 */

/** The four language skills surfaced on the home page. */
export type SkillId = "reading" | "listening" | "writing" | "speaking";

/** Accent colour used by a card, badge or placeholder panel. */
export type AccentTone = "indigo" | "teal" | "amber" | "rose" | "violet";

/** A single entry in the primary navigation. */
export interface NavItem {
  /** Key of the label in `commonMessages.nav`. */
  key: "reading" | "listening" | "writing" | "speaking" | "conversation" | "progress" | "profile";
  href: string;
}

/** Summary card shown for each skill on the home page. */
export interface SkillSummary {
  id: SkillId;
  name: string;
  tagline: string;
  description: string;
  href: string;
  tone: AccentTone;
  /** Two or three short keywords describing what the learner practises. */
  focusAreas: string[];
}

/** Copy for a placeholder ("coming soon") route. */
export interface ComingSoonContent {
  eyebrow: string;
  title: string;
  description: string;
  tone: AccentTone;
  /** What the finished module will offer. */
  plannedFeatures: string[];
}

/** Marketing copy for the product itself. */
export interface SiteIdentity {
  name: string;
  shortTagline: string;
  description: string;
}

/** Tailwind class fragments for one accent tone. */
export interface ToneClasses {
  iconTile: string;
  badge: string;
  accentText: string;
  hoverBorder: string;
}
