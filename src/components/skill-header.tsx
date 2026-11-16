import { getLocale } from "@/i18n/server";
import { Container } from "@/components/container";
import { getSkills } from "@/lib/site";
import type { SkillId } from "@/lib/types";

/** The heading shared by the four practice lists. */
export async function SkillHeader({ skill }: { skill: SkillId }) {
  const entry = getSkills(await getLocale()).find((item) => item.id === skill);
  if (!entry) return null;

  return (
    <div className="border-b border-line bg-surface">
      <Container className="py-8 sm:py-10">
        <h1 className="text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
          {entry.name}
        </h1>
      </Container>
    </div>
  );
}
