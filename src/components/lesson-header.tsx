import Link from "next/link";

import { linkQuiet, skeleton } from "@/lib/ui";

/** Back link, title and key facts at the top of a practice or result page. */
export function LessonHeader({
  backHref,
  backLabel,
  title,
  facts,
  titleId,
}: {
  backHref: string;
  backLabel: string;
  title: string;
  facts: (string | null | undefined)[];
  titleId?: string;
}) {
  return (
    <header>
      <Link href={backHref} className={linkQuiet}>
        {backLabel}
      </Link>
      <h1
        id={titleId}
        className="mt-3 text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-4xl"
      >
        {title}
      </h1>
      <p className="mt-2 flex flex-wrap gap-x-4 gap-y-0.5 text-sm text-ink-muted">
        {facts.filter(Boolean).map((fact) => (
          <span key={fact}>{fact}</span>
        ))}
      </p>
    </header>
  );
}

export function WorkspaceSkeleton() {
  return (
    <div aria-hidden="true">
      <div className={`${skeleton} h-4 w-36`} />
      <div className={`${skeleton} mt-4 h-9 w-2/3`} />
      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <div className={`${skeleton} h-80`} />
        <div className={`${skeleton} h-80`} />
      </div>
    </div>
  );
}

export function ResultSkeleton() {
  return (
    <div aria-hidden="true">
      <div className={`${skeleton} h-4 w-36`} />
      <div className={`${skeleton} mt-4 h-40`} />
      <div className={`${skeleton} mt-8 h-64`} />
    </div>
  );
}
