import { type Locale } from "@/i18n/config";
import { progressMessages } from "@/i18n/messages/progress";
import Link from "next/link";
import { getWeaknessOverview, WEAKNESS_THRESHOLDS as T, type Item, type WeaknessOverview } from "@/lib/progress/weakness";
import { linkInline, sheet, skeleton } from "@/lib/ui";

const badgeClass = {
  recurring: "text-pen",
  "low-score": "text-caution",
  early: "text-ink-muted",
};

function EvidenceItem({ item, locale }: { item: Item; locale: Locale }) {
  const t = progressMessages[locale];
  return <li className="min-w-0 space-y-1.5 break-words py-3">
    <p className={`text-sm font-semibold ${badgeClass[item.kind]}`}>{t.badges[item.kind]}</p>
    <h4 className="text-lg font-semibold leading-snug text-ink">{item.title}</h4>
    <p title={item.rule} className="text-[0.9375rem] leading-6 text-ink-soft">{item.evidence}</p>
    {item.example && <blockquote className="border-l-2 border-marker pl-3 text-[0.9375rem] leading-6 text-ink"><p><del className="text-pen">{item.example.original}</del> &rarr; <ins className="no-underline">{item.example.corrected}</ins></p><p className="text-ink-soft">{item.example.explanation}</p></blockquote>}
    {!!item.suggestions?.length && <div className="text-[0.9375rem] text-ink-soft"><p className="font-medium text-ink">{t.latestAssessment}</p><ul className="mt-1 list-inside list-disc space-y-0.5">{item.suggestions.map((s,i) => <li key={i}>{s}</li>)}</ul></div>}
    {item.recommendation && <p className="pt-0.5 text-sm"><Link className={linkInline} href={item.recommendation.href} title={item.recommendation.reason}>{t.practisePrefix} {item.recommendation.title}</Link></p>}
  </li>;
}
export function WeaknessView({ overview, locale = "en" }: { overview: WeaknessOverview; locale?: Locale }) {
  const t = progressMessages[locale];
  const shown = new Set(overview.priorities.map(i => `${i.skill}:${i.key}:${i.kind}`));
  return <section aria-labelledby="focus-heading" className="min-w-0 break-words">
    <h2 id="focus-heading" className="text-2xl font-semibold text-ink">{t.focus}</h2>
    <div className={`${sheet} mt-3 divide-y divide-line`}>
      {overview.priorities.length ? <div className="p-5"><h3 className="font-sans text-base font-semibold text-ink">{t.priorities}</h3><ul className="divide-y divide-line">{overview.priorities.map(i => <EvidenceItem key={`${i.skill}:${i.key}:${i.kind}`} item={i} locale={locale}/>)}</ul></div> : null}
      {overview.skills.map(card => {
        // Anything already listed under Top priorities is not repeated here.
        const rest = card.items.filter(i => !shown.has(`${i.skill}:${i.key}:${i.kind}`));
        if (card.status !== "insufficient" && rest.length === 0) return null;
        return <section key={card.skill} className="min-w-0 p-5">
          <h3 className="text-lg font-semibold text-ink">{card.skill === "speaking" ? t.speakingContent : t.skills[card.skill]}</h3>
          {card.status === "insufficient" && <div className="mt-1 text-[0.9375rem] leading-6 text-ink-soft"><p><span className="font-medium text-ink">{t.insufficient}</span> {card.shortfall.replace(/\.?$/, ".")}</p>{card.startingPoint && <p className="mt-1 text-sm"><Link className={linkInline} href={card.startingPoint.href}>{t.startWith} {card.startingPoint.title}</Link></p>}</div>}
          {rest.length ? <ul className="divide-y divide-line">{rest.map(i => <EvidenceItem key={`${i.kind}:${i.key}`} item={i} locale={locale}/>)}</ul> : null}
        </section>;
      })}
      <details className="p-5 text-[0.9375rem] leading-6 text-ink-soft"><summary className="cursor-pointer font-semibold text-ink">{t.calculated}</summary>
        <div className="mt-2 space-y-2 text-ink-muted">
        <p>{t.windows(T)}</p>
        <p>{t.patterns(T)}</p>
        <p>{t.storedLabels(T)}</p>
        <p>{t.lowScoresCalculation(T)}</p>
        </div>
      </details>
    </div>
  </section>;
}
export async function WeaknessSection({ userId }: { userId: string }) {
  const { getLocale } = await import("@/i18n/server");
  const locale = await getLocale();
  return <WeaknessView overview={await getWeaknessOverview(userId, undefined, locale)} locale={locale}/>;
}
export async function WeaknessSkeleton() {
  const { getLocale } = await import("@/i18n/server");
  const t = progressMessages[await getLocale()];
  return <section aria-label={t.loadingFocus} aria-busy="true" className="min-w-0"><h2 className="text-2xl font-semibold text-ink">{t.focus}</h2><div className={`${skeleton} mt-3 h-64`}/></section>;
}
