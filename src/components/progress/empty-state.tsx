import { getMessages } from "@/i18n/server";
import { progressMessages } from "@/i18n/messages/progress";
import Link from "next/link";

import { skills } from "@/lib/site";
import { buttonPrimary, buttonSecondary, sheet } from "@/lib/ui";

/**
 * Shown when the learner has no attempts across the four skills.
 * No placeholder numbers: it points at the skills that can fill it.
 */
export async function ProgressEmptyState() {
  const t = await getMessages(progressMessages);
  return (
    <section aria-labelledby="progress-empty-heading" className={`${sheet} p-6 sm:p-8`}>
      <h2 id="progress-empty-heading" className="text-2xl font-semibold text-ink">
        {t.empty}
      </h2>
      <p className="mt-2 text-base leading-7 text-ink-soft">
        {t.emptyBody}
      </p>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        {skills.map((skill, index) => (
          <Link
            key={skill.id}
            href={skill.href}
            className={index === 0 ? buttonPrimary : buttonSecondary}
          >
            {t.startSkill(skill.id)}
          </Link>
        ))}
      </div>
    </section>
  );
}
