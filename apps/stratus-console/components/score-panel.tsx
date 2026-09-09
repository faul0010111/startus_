import type { SecurityScore } from "@stratus/shared-types";
import { bandLabel } from "@/lib/format";

/**
 * The hero of the console. The number is the posture score (100 is clean); the
 * arc is drawn from the same value so a glance and a read agree.
 */
export function ScorePanel({ score }: { score: SecurityScore }) {
  const radius = 78;
  const circumference = Math.PI * radius;
  const filled = (score.score / 100) * circumference;
  const stroke =
    score.band === "severe" || score.band === "high"
      ? "var(--danger)"
      : score.band === "elevated"
        ? "var(--warn)"
        : "var(--healthy)";

  return (
    <section className="panel flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
      <svg viewBox="0 0 200 110" className="h-28 w-48 shrink-0" role="img" aria-label={`Security score ${score.score}`}>
        <path d="M 22 100 A 78 78 0 0 1 178 100" fill="none" stroke="var(--hairline)" strokeWidth="10" />
        <path
          d="M 22 100 A 78 78 0 0 1 178 100"
          fill="none"
          stroke={stroke}
          strokeWidth="10"
          strokeDasharray={`${filled} ${circumference}`}
          strokeLinecap="butt"
        />
        <text x="100" y="86" textAnchor="middle" className="fill-ink font-mono" fontSize="38">
          {Math.round(score.score)}
        </text>
      </svg>
      <div className="min-w-0">
        <h1 className="font-mono text-sm tracking-[0.18em] text-muted">STRATUS SECURITY SCORE</h1>
        <p className="mt-1 text-lg text-ink">{bandLabel(score.band)}</p>
        <p className="mt-2 text-sm text-muted">
          <span className={score.direction === "degrading" ? "text-danger" : "text-healthy"}>
            {score.direction === "degrading" ? "▲" : "▼"} {Math.abs(score.changePercent)}%
          </span>{" "}
          risk {score.direction === "degrading" ? "increase" : "decrease"} over the last 24 hours
        </p>
      </div>
    </section>
  );
}
