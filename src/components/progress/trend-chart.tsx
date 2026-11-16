import { getMessages, getLocale } from "@/i18n/server";
import { progressMessages } from "@/i18n/messages/progress";
import { cn } from "@/lib/cn";
import { formatShortDate } from "@/lib/progress/format";
import type { TrendPoint } from "@/lib/progress/stats";

/**
 * A dependency-free SVG line chart for one skill's recent percentages.
 *
 * The viewBox is fixed and the SVG scales with its container width, so stroke
 * widths and dots keep their proportions on every breakpoint. With a single
 * point the chart shows that point instead of a line.
 */

const WIDTH = 320;
const HEIGHT = 96;
const PAD_X = 10;
const PAD_Y = 14;

function xFor(index: number, count: number): number {
  if (count <= 1) return WIDTH / 2;
  return PAD_X + (index / (count - 1)) * (WIDTH - PAD_X * 2);
}

function yFor(percentage: number): number {
  const bounded = Math.min(100, Math.max(0, percentage));
  return HEIGHT - PAD_Y - (bounded / 100) * (HEIGHT - PAD_Y * 2);
}

export async function TrendChart({
  points,
  accentClassName,
  skillLabel,
}: {
  points: readonly TrendPoint[];
  /** Text colour class carrying the accent, e.g. `text-ink`. */
  accentClassName: string;
  skillLabel: string;
}) {
  const t = await getMessages(progressMessages);
  const locale = await getLocale();
  const coordinates = points.map((point, index) => ({
    point,
    x: xFor(index, points.length),
    y: yFor(point.percentage),
  }));

  const line = coordinates.map(({ x, y }) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area =
    coordinates.length > 1
      ? [
          `M ${coordinates[0].x.toFixed(1)} ${HEIGHT - PAD_Y}`,
          ...coordinates.map(({ x, y }) => `L ${x.toFixed(1)} ${y.toFixed(1)}`),
          `L ${coordinates[coordinates.length - 1].x.toFixed(1)} ${HEIGHT - PAD_Y}`,
          "Z",
        ].join(" ")
      : null;

  const summary = coordinates.length === 0
    ? t.noTrend(skillLabel)
    : t.trend(skillLabel, coordinates.map(({ point }) => t.trendPoint(point.percentage, formatShortDate(point.completedAt, locale))).join(", "));

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-label={summary}
      className={cn("h-auto w-full", accentClassName)}
    >
      {/* 0 / 50 / 100% guides */}
      {[0, 50, 100].map((guide) => (
        <line
          key={guide}
          x1={PAD_X}
          x2={WIDTH - PAD_X}
          y1={yFor(guide)}
          y2={yFor(guide)}
          stroke="currentColor"
          strokeWidth={1}
          strokeDasharray={guide === 0 ? undefined : "3 4"}
          className="text-line"
          opacity={guide === 0 ? 1 : 0.7}
        />
      ))}

      {area ? <path d={area} fill="currentColor" opacity={0.08} /> : null}

      {coordinates.length > 1 ? (
        <polyline
          points={line}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}

      {coordinates.map(({ point, x, y }) => (
        <circle
          key={point.id}
          cx={x}
          cy={y}
          r={3.5}
          fill="currentColor"
          stroke="#ffffff"
          strokeWidth={1.5}
        />
      ))}
    </svg>
  );
}
