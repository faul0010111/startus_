"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchAssets } from "@/lib/api";
import { DemoBanner } from "@/components/demo-banner";

const HEALTH_TONE: Record<string, string> = {
  healthy: "text-healthy",
  "at-risk": "text-warn",
  critical: "text-danger",
};

export default function Assets() {
  const { data, isLoading } = useQuery({ queryKey: ["assets"], queryFn: fetchAssets });

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <header>
        <h1 className="font-mono text-lg tracking-[0.2em]">ASSET INVENTORY</h1>
        <p className="mt-1 text-sm text-muted">Ranked by risk, so the top of the list is the work queue.</p>
      </header>

      <DemoBanner live={data?.live ?? true} />

      {isLoading ? (
        <p className="text-sm text-muted">Loading assets…</p>
      ) : (
        <div className="panel overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-hairline text-left font-mono text-xs text-muted">
                <th className="px-4 py-2 font-normal">Asset</th>
                <th className="px-4 py-2 font-normal">Kind</th>
                <th className="px-4 py-2 font-normal">Environment</th>
                <th className="px-4 py-2 font-normal">Criticality</th>
                <th className="px-4 py-2 font-normal">Health</th>
                <th className="px-4 py-2 font-normal">Risk</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {(data?.data ?? []).map((asset) => (
                <tr key={asset.id} className="hover:bg-raised">
                  <td className="px-4 py-3">
                    <p className="text-ink">{asset.name}</p>
                    <p className="font-mono text-xs text-muted">{asset.id}</p>
                  </td>
                  <td className="px-4 py-3 text-muted">{asset.kind}</td>
                  <td className="px-4 py-3 text-muted">{asset.environment}</td>
                  <td className="px-4 py-3 font-mono text-muted">{asset.criticality}</td>
                  <td className={`px-4 py-3 ${HEALTH_TONE[asset.health]}`}>{asset.health}</td>
                  <td className="px-4 py-3 font-mono">{asset.riskScore}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
