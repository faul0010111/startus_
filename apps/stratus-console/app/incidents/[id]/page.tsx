"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { fetchIncident } from "@/lib/api";
import { clockTime, relativeTime, severityClass } from "@/lib/format";

export default function IncidentDetail() {
  // Next.js 15 turns the `params` prop into a Promise. `useParams()` is the
  // supported way to read a dynamic segment from a Client Component and works
  // the same way on 14 and 15, so no `use()`/React 19 unwrapping is needed.
  const { id } = useParams<{ id: string }>();
  const { data, isLoading } = useQuery({ queryKey: ["incident", id], queryFn: () => fetchIncident(id) });
  const incident = data?.data;

  if (isLoading) return <p className="p-6 text-sm text-muted">Loading incident…</p>;
  if (!incident) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted">
          No incident with id {id}. <Link href="/incidents" className="text-signal">Back to incident command</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <Link href="/incidents" className="font-mono text-xs text-muted hover:text-ink">
        ← Incident command
      </Link>

      <header className="panel p-5">
        <div className="flex flex-wrap items-baseline gap-3">
          <span className="font-mono text-danger">{incident.priority}</span>
          <span className="font-mono text-xs text-muted">{incident.id}</span>
          <span className="text-xs text-muted">{incident.status}</span>
        </div>
        <h1 className="mt-2 text-lg text-ink">{incident.title}</h1>
        <dl className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs text-muted">Risk score</dt>
            <dd className="font-mono text-xl">{incident.riskScore}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Confidence</dt>
            <dd className="font-mono text-xl">{Math.round(incident.confidence * 100)}%</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Environment</dt>
            <dd className="text-ink">{incident.environment}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Opened</dt>
            <dd className="text-ink">{relativeTime(incident.openedAt)}</dd>
          </div>
        </dl>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="panel">
          <h2 className="border-b border-hairline px-4 py-2 font-mono text-xs tracking-[0.18em] text-muted">TIMELINE</h2>
          <ol className="p-4">
            {incident.timeline.map((entry, i) => (
              <li key={`${entry.at}-${i}`} className="relative flex gap-4 pb-5 last:pb-0">
                <span className="font-mono text-xs text-muted">{clockTime(entry.at)}</span>
                <span className="absolute left-[52px] top-1.5 h-full w-px bg-hairline last:hidden" aria-hidden />
                <span className="ml-2 flex-1">
                  <span className={`font-mono text-xs ${severityClass(entry.severity ?? "info")}`}>{entry.eventType}</span>
                  <p className="text-sm text-ink">{entry.summary}</p>
                  <p className="text-xs text-muted">{entry.source}</p>
                </span>
              </li>
            ))}
          </ol>
        </section>

        <div className="space-y-4">
          <section className="panel">
            <h2 className="border-b border-hairline px-4 py-2 font-mono text-xs tracking-[0.18em] text-muted">
              SUGGESTED ACTIONS
            </h2>
            <ul className="divide-y divide-hairline">
              {incident.suggestedActions.map((action) => (
                <li key={action.id} className="px-4 py-3">
                  <p className="text-sm text-ink">{action.title}</p>
                  <p className="mt-1 text-xs text-muted">{action.rationale}</p>
                  {action.automatable && <p className="mt-1 font-mono text-xs text-signal">automatable</p>}
                </li>
              ))}
            </ul>
          </section>

          <section className="panel">
            <h2 className="border-b border-hairline px-4 py-2 font-mono text-xs tracking-[0.18em] text-muted">
              RELATED RESOURCES
            </h2>
            <div className="space-y-3 p-4 text-sm">
              <div>
                <p className="text-xs text-muted">Assets</p>
                <p className="font-mono text-ink">{incident.relatedAssetIds.join(", ") || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted">Findings</p>
                <p className="font-mono text-ink">{incident.relatedFindingIds.join(", ") || "—"}</p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
