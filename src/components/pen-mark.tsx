/**
 * A score written the way a teacher marks a paper: red pen, slightly off the
 * horizontal, ringed in one stroke. The ring is drawn once when the page loads
 * (see `.pen-mark` in globals.css) and stretches to whatever the score needs.
 */
export function PenMark({
  value,
  outOf,
  label,
}: {
  value: string;
  outOf: string;
  /** Read out instead of the drawing, e.g. "4 out of 5". */
  label: string;
}) {
  return (
    <p className="pen-mark">
      <span className="sr-only">{label}</span>
      <span aria-hidden="true" className="pen-mark-score">
        <span className="pen-mark-value">{value}</span>
        <span className="pen-mark-out-of">/{outOf}</span>
      </span>
      <svg
        aria-hidden="true"
        className="pen-mark-ring"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        fill="none"
      >
        <path
          d="M80 13C56 1 14 7 7 43c-6 34 26 54 56 49 30-5 38-40 28-63C85 15 67 6 46 10"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </p>
  );
}
