"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { fetchFindings } from "@/lib/api";
import { severityClass, relativeTime } from "@/lib/format";
import { DemoBanner } from "@/components/demo-banner";

const FILTERS = ["all", "critical", "high", "medium", "low"] as const;

export default function Findings() {
  const [severity, setSeverity] = useState<(typeof FILTERS)[number]>("all");
  const { data, isLoading } = useQuery({
    queryKey: ["findings", severity],
    queryFn: () => fetchFindings(severity === "all" ? undefined : severity),
  });

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-mono text-lg tracking-[0.2em]">SECURITY FINDINGS</h1>
        <div className="flex gap-1">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setSeverity(f)}
              className={`px-2 py-1 font-mono text-xs capitalize ${f === severity ? "bg-raised text-ink" : "text-muted hover:text-ink"}`}
            >
              {f}
            </button>
          ))}
        </div>
      </header>

      <DemoBanner live={data?.live ?? true} />

      {isLoading ? (
        <p className="text-sm text-muted">Loading findings…</p>
      ) : (
        <div className="panel overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-hairline text-left font-mono text-xs text-muted">
                <th className="px-4 py-2 font-normal">Severity</th>
                <th className="px-4 py-2 font-normal">Finding</th>
                <th className="px-4 py-2 font-normal">Asset</th>
                <th className="px-4 py-2 font-normal">Category</th>
                <th className="px-4 py-2 font-normal">Risk</th>
                <th className="px-4 py-2 font-normal">First seen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {(data?.data ?? []).map((finding) => (
                <tr key={finding.id} className="hover:bg-raised">
                  <td className={`px-4 py-3 font-mono capitalize ${severityClass(finding.severity)}`}>{finding.severity}</td>
                  <td className="px-4 py-3">
                    <p className="text-ink">{finding.title}</p>
                    <p className="font-mono text-xs text-muted">{finding.ruleId}</p>
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {finding.assetName}
                    {finding.internetExposed && <span className="ml-2 font-mono text-xs text-danger">internet-facing</span>}
                  </td>
                  <td className="px-4 py-3 text-muted">{finding.category}</td>
                  <td className="px-4 py-3 font-mono">{finding.riskScore}</td>
                  <td className="px-4 py-3 text-muted">{relativeTime(finding.firstSeenAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
