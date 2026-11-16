import { type Locale } from "@/i18n/config";
import { sharedMessages } from "@/i18n/messages/shared";
import type { NavItem, SiteIdentity, SkillSummary } from "@/lib/types";

export const site: SiteIdentity = {
  name: "Lingua",
  shortTagline: "English practice, marked and explained",
  description:
    "A single place to practise reading, listening, writing and speaking, with clear feedback and progress tracking.",
};

/** Primary navigation, shared by the header and the footer. */
export const navigation: NavItem[] = [
  { key: "reading", href: "/reading" },
  { key: "listening", href: "/listening" },
  { key: "writing", href: "/writing" },
  { key: "speaking", href: "/speaking" },
  { key: "conversation", href: "/conversation" },
  { key: "progress", href: "/progress" },
];

/** The four skills presented as cards on the home page. */
export const skills: SkillSummary[] = [
  {
    id: "reading",
    name: "Reading",
    tagline: "Understand what you read",
    description:
      "Read short passages and see the reason behind every answer.",
    href: "/reading",
    tone: "indigo",
    focusAreas: ["Passages", "Comprehension", "Vocabulary"],
  },
  {
    id: "listening",
    name: "Listening",
    tagline: "Train your ear",
    description:
      "Listen at your own speed, answer, then check the transcript.",
    href: "/listening",
    tone: "teal",
    focusAreas: ["Audio", "Detail", "Note-taking"],
  },
  {
    id: "writing",
    name: "Writing",
    tagline: "Write with clarity",
    description:
      "Write on a topic and get corrections with a reason for each.",
    href: "/writing",
    tone: "amber",
    focusAreas: ["Prompts", "Structure", "Grammar"],
  },
  {
    id: "speaking",
    name: "Speaking",
    tagline: "Speak with confidence",
    description:
      "Record your answer and get feedback on what you said.",
    href: "/speaking",
    tone: "rose",
    focusAreas: ["Prompts", "Transcript", "Content"],
  },
];

/** Link to the progress view, presented separately from the four skills. */
export const progressLink: NavItem = { key: "progress", href: "/progress" };

/** Localized presentation with an English default for existing callers. */
export function getSkills(locale: Locale = "en"): SkillSummary[] {
  return skills.map((skill) => ({ ...skill, ...sharedMessages[locale].skills[skill.id] }));
}
