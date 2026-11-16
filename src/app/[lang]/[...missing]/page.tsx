import { notFound } from "next/navigation";

/**
 * Every path is rewritten under `[lang]`, so an unknown path lands here instead
 * of reaching a top-level 404 outside the root layout. It renders the
 * `[lang]/not-found.tsx` page inside the normal layout.
 */
export default function MissingPage(): never {
  notFound();
}
