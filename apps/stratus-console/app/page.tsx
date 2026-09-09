"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type { TimeWindow } from "@stratus/shared-types";
import { fetchOverview, fetchIncidents } from "@/lib/api";
import { ScorePanel } from "@/components/score-panel";
import { StatRow } from "@/components/stat-row";
import { SeverityBreakdown } from "@/components/severity-breakdown";
import { RiskTrendChart } from "@/components/risk-trend-chart";
import { LiveFeed } from "@/components/live-feed";
import { IncidentTable } from "@/components/incident-table";
import { DemoBanner } from "@/components/demo-banner";

export default function CommandCenter() {
  const [range, setRange] = useState<TimeWindow>("7d");
  const overview = useQuery({ queryKey: ["overview", range], queryFn: () => fetchOverview(range) });
  const incidents = useQuery({ queryKey: ["incidents", "open"], queryFn: () => fetchIncidents() });

  if (overview.isLoading || !overview.data) {
    return <div className="p-6 text-sm text-muted">Loading command center…</div>;
  }

  const { score, assets, findings, incidents: incidentSummary, trend } = overview.data.data;

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="font-mono text-lg tracking-[0.2em]">STRATUS COMMAND CENTER</h1>
        <p className="text-sm text-muted">Observe. Correlate. Prioritize. Secure.</p>
      </header>

      <DemoBanner live={overview.data.live} />
      <ScorePanel score={score} />

      <div className="grid gap-4 lg:grid-cols-2">
        <StatRow
          title="INFRASTRUCTURE"
          stats={[
            { label: "Total assets", value: assets.total },
            { label: "Healthy", value: assets.healthy, tone: "healthy" },
            { label: "At risk", value: assets.atRisk, tone: "warn" },
            { label: "Critical", value: assets.critical, tone: "danger" },
          ]}
        />
        <StatRow
          title="ACTIVE INCIDENTS"
          stats={[
            { label: "P1 critical", value: incidentSummary.p1, tone: "danger" },
            { label: "P2 high", value: incidentSummary.p2, tone: "warn" },
            { label: "P3 medium", value: incidentSummary.p3 },
            { label: "Mean time to detect (min)", value: incidentSummary.meanTimeToDetectMinutes ?? 0 },
          ]}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RiskTrendChart trend={trend} window={range} onWindowChange={setRange} />
        </div>
        <SeverityBreakdown findings={findings} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h2 className="mb-2 font-mono text-xs tracking-[0.18em] text-muted">PRIORITIZED INCIDENTS</h2>
          <IncidentTable incidents={(incidents.data?.data ?? []).slice(0, 6)} />
        </div>
        <LiveFeed />
      </div>
    </div>
  );
}
