"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchIncidents } from "@/lib/api";
import { IncidentTable } from "@/components/incident-table";
import { DemoBanner } from "@/components/demo-banner";

export default function IncidentCommand() {
  const { data, isLoading } = useQuery({ queryKey: ["incidents"], queryFn: () => fetchIncidents() });

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <header>
        <h1 className="font-mono text-lg tracking-[0.2em]">STRATUS INCIDENT COMMAND</h1>
        <p className="mt-1 text-sm text-muted">
          Every incident here was opened by the correlation engine, not by a human triaging alerts.
        </p>
      </header>
      <DemoBanner live={data?.live ?? true} />
      {isLoading ? <p className="text-sm text-muted">Loading incidents…</p> : <IncidentTable incidents={data?.data ?? []} />}
    </div>
  );
}
