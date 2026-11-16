export const buttonBase =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";

export const buttonPrimary = `${buttonBase} bg-ink text-white hover:bg-ink-soft`;

export const buttonSecondary = `${buttonBase} border border-line-strong bg-surface text-ink hover:border-ink`;

/** Text link with the highlighter underline used across the product. */
export const linkInline =
  "font-semibold text-ink underline decoration-marker decoration-[3px] underline-offset-4 transition-colors hover:decoration-ink";

/** Quiet navigation link, e.g. back to the list. */
export const linkQuiet =
  "text-sm font-medium text-ink-muted transition-colors hover:text-ink";

export const field =
  "w-full rounded-lg border border-line-strong bg-surface px-3.5 py-2.5 text-base text-ink outline-none transition-colors placeholder:text-ink-muted focus:border-ink focus:ring-1 focus:ring-ink disabled:opacity-60";

/** One answer choice. Selecting it highlights the row, as a marker would. */
export const choiceRow =
  "flex cursor-pointer items-start gap-3 rounded-lg border border-line bg-surface px-4 py-3 text-[0.9375rem] leading-6 text-ink transition-colors hover:border-ink-muted has-[:checked]:border-ink has-[:checked]:bg-marker-soft has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink";

export const choiceInput = "mt-1 size-4 shrink-0 accent-ink";

/** The white sheet that holds a passage, a prompt or the learner's own text. */
export const sheet = "rounded-[3px] border border-line bg-surface";

export const alertError =
  "rounded-lg bg-pen-soft px-4 py-3 text-sm font-medium text-pen";

export const alertNotice =
  "rounded-lg bg-caution-soft px-4 py-3 text-sm font-medium text-caution";

/** Serif reading text: passages, prompts and anything the learner wrote. */
export const readingText = "font-display text-[1.0625rem] leading-8 text-ink";

/** Loading placeholder: blank ruled paper, waiting to be written on. */
export const skeleton = "ruled";
