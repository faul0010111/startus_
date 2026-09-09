import Link from "next/link";
import type { Incident } from "@stratus/shared-types";
import { relativeTime } from "@/lib/format";

const PRIORITY_TONE: Record<string, string> = {
  P1: "text-danger",
  P2: "text-[#ff8a4c]",
  P3: "text-warn",
  P4: "text-muted",
};

export function IncidentTable({ incidents }: { incidents: Incident[] }) {
  if (incidents.length === 0) {
    return (
      <div className="panel p-6 text-sm text-muted">
        No open incidents. Correlated signals will open one automatically.
      </div>
    );
  }

  return (
    <div className="panel overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-hairline text-left font-mono text-xs text-muted">
            <th className="px-4 py-2 font-normal">Priority</th>
            <th className="px-4 py-2 font-normal">Incident</th>
            <th className="px-4 py-2 font-normal">Environment</th>
            <th className="px-4 py-2 font-normal">Risk</th>
            <th className="px-4 py-2 font-normal">Confidence</th>
            <th className="px-4 py-2 font-normal">Opened</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-hairline">
          {incidents.map((incident) => (
            <tr key={incident.id} className="hover:bg-raised">
              <td className={`px-4 py-3 font-mono ${PRIORITY_TONE[incident.priority]}`}>{incident.priority}</td>
              <td className="px-4 py-3">
                <Link href={`/incidents/${incident.id}`} className="text-ink hover:text-signal">
                  {incident.title}
                </Link>
                <p className="font-mono text-xs text-muted">{incident.correlationId}</p>
              </td>
              <td className="px-4 py-3 text-muted">{incident.environment}</td>
              <td className="px-4 py-3 font-mono">{incident.riskScore}</td>
              <td className="px-4 py-3 font-mono text-muted">{Math.round(incident.confidence * 100)}%</td>
              <td className="px-4 py-3 text-muted">{relativeTime(incident.openedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
