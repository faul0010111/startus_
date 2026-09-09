import type { FindingSummary } from "@stratus/shared-types";
import { SEVERITY_COLOR, number } from "@/lib/format";

const ORDER = ["critical", "high", "medium", "low", "info"] as const;

/** Horizontal bars beat a donut here: the eye compares lengths, not angles. */
export function SeverityBreakdown({ findings }: { findings: FindingSummary }) {
  const max = Math.max(...ORDER.map((k) => findings[k]), 1);

  return (
    <section className="panel">
      <h2 className="border-b border-hairline px-4 py-2 font-mono text-xs tracking-[0.18em] text-muted">
        SECURITY FINDINGS
      </h2>
      <ul className="p-4">
        {ORDER.map((severity) => (
          <li key={severity} className="mb-3 last:mb-0">
            <div className="flex items-baseline justify-between text-sm">
              <span className="capitalize text-ink">{severity}</span>
              <span className="font-mono text-muted">{number(findings[severity])}</span>
            </div>
            <div className="mt-1 h-1.5 w-full bg-raised">
              <div
                className="h-full"
                style={{ width: `${(findings[severity] / max) * 100}%`, backgroundColor: SEVERITY_COLOR[severity] }}
              />
            </div>
          </li>
        ))}
      </ul>
      <p className="border-t border-hairline px-4 py-2 text-xs text-muted">
        {number(findings.resolvedLast7d)} resolved in the last 7 days
      </p>
    </section>
  );
}
