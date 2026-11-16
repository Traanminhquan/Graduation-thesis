import { sharedMessages } from "@/i18n/messages/shared";

import Link from "next/link";

import { linkInline, sheet, skeleton } from "@/lib/ui";

export type PracticeItem = {
  id: string;
  href: string;
  title: string;
  summary?: string | null;
  /** Short facts about the task, e.g. "5 questions". */
  facts: string[];
  /** The learner's own state, e.g. "Best 80%". */
  status?: string | null;
  actionLabel: string;
  secondary?: { href: string; label: string } | null;
};

export type PracticeGroup = { label: string; items: PracticeItem[]; level?: "A1" | "A2" | "B1" | "B2" | "C1" };

const LEVELS = ["BEGINNER", "INTERMEDIATE", "ADVANCED"] as const;

const CEFR_LEVELS = [
  ["A1", "A1 Beginner"],
  ["A2", "A2 Elementary"],
  ["B1", "B1 Intermediate"],
  ["B2", "B2 Upper intermediate"],
  ["C1", "C1 Advanced"],
] as const;

/**
 * Orders tasks by level, dropping levels that have nothing in them. When every
 * task has a CEFR level, groups by the five CEFR levels; otherwise by the three
 * difficulty levels, so a half-labelled database never splits a list unevenly.
 */
export function groupByLevel<T extends { difficulty: string; cefr?: string | null }>(
  rows: readonly T[],
  labels: Record<(typeof LEVELS)[number], string>,
  toItem: (row: T) => PracticeItem,
): PracticeGroup[] {
  if (rows.length > 0 && rows.every((row) => row.cefr)) {
    return CEFR_LEVELS.map(([level, label]) => ({
      label,
      level,
      items: rows.filter((row) => row.cefr === level).map(toItem),
    })).filter((group) => group.items.length > 0);
  }
  return LEVELS.map((level) => ({
    label: labels[level],
    items: rows.filter((row) => row.difficulty === level).map(toItem),
  })).filter((group) => group.items.length > 0);
}

/** The index of tasks for one skill: one row per task, grouped by level. */
export async function PracticeList({ groups }: { groups: PracticeGroup[] }) {
  const { getMessages } = await import("@/i18n/server");
  const t = await getMessages(sharedMessages);
  return (
    <div className="space-y-10">
      {groups.map((group) => (
        <section
          key={group.label}
          aria-label={group.level ? t.levels[group.level] : group.label}
          className="grid gap-3 lg:grid-cols-[10rem_minmax(0,1fr)] lg:gap-8"
        >
          <h2 className="text-xl font-semibold text-ink lg:pt-5">{group.level ? t.levels[group.level] : group.label}</h2>
          <ul className={`${sheet} divide-y divide-line`}>
            {group.items.map((item) => (
              <PracticeRow key={item.id} item={item} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function PracticeRow({ item }: { item: PracticeItem }) {
  return (
    <li className="group relative grid gap-3 p-5 transition-colors first:rounded-t-[3px] last:rounded-b-[3px] hover:bg-canvas sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-8">
      <div className="min-w-0">
        <h3 className="text-xl font-semibold leading-snug text-ink">
          {/* The title link covers the whole row, so the row is one large target. */}
          <Link href={item.href} className="after:absolute after:inset-0 after:content-['']">
            {item.title}
          </Link>
        </h3>
        {item.summary ? (
          <p className="mt-1 line-clamp-2 text-[0.9375rem] leading-6 text-ink-soft">
            {item.summary}
          </p>
        ) : null}
        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-0.5 text-sm text-ink-muted">
          {item.facts.map((fact) => (
            <span key={fact}>{fact}</span>
          ))}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm sm:justify-end">
        {item.status ? (
          <span className="font-semibold text-tick">{item.status}</span>
        ) : null}
        {item.secondary ? (
          <Link href={item.secondary.href} className={`relative z-10 ${linkInline}`}>
            {item.secondary.label}
          </Link>
        ) : null}
        <span className="font-semibold text-ink underline decoration-marker decoration-[3px] underline-offset-4 group-hover:decoration-ink">
          {item.actionLabel}
        </span>
      </div>
    </li>
  );
}

export function PracticeListEmpty({ title, body }: { title: string; body: string }) {
  return (
    <div className={`${sheet} p-8`}>
      <h2 className="text-xl font-semibold text-ink">{title}</h2>
      <p className="mt-2 max-w-xl text-base leading-7 text-ink-soft">{body}</p>
    </div>
  );
}

export function PracticeListSkeleton() {
  return (
    <div aria-hidden="true" className="grid gap-3 lg:grid-cols-[10rem_minmax(0,1fr)] lg:gap-8">
      <div className={`${skeleton} h-6 w-28 lg:mt-5`} />
      <div className="space-y-3">
        {[0, 1, 2].map((row) => (
          <div key={row} className={`${skeleton} h-24`} />
        ))}
      </div>
    </div>
  );
}
