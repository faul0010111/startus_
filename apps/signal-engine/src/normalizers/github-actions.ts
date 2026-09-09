import type { NormalizedSignal } from "@stratus/shared-types";
import { baseSignal } from "./index.js";

/** GitHub Actions workflow_run webhook, mapped to a deployment signal. */
export function normalizeGithubActions(raw: any): NormalizedSignal[] {
  const run = raw?.workflow_run ?? raw;
  if (!run) return [];
  const failed = run.conclusion && run.conclusion !== "success";
  return [
    baseSignal({
      type: "deployment-event",
      source: "github.actions",
      resourceId: `service:${run.repository?.name ?? "unknown"}`,
      service: run.repository?.name ?? "unknown",
      severity: failed ? "high" : "info",
      title: `Deployment ${run.conclusion ?? "completed"} for ${run.head_branch ?? "main"}`,
      environment: run.environment ?? "production",
      observedAt: run.updated_at ?? new Date().toISOString(),
      attributes: {
        deploymentId: String(run.id ?? crypto.randomUUID()),
        pipeline: run.name,
        commitSha: run.head_sha,
        actor: run.actor?.login,
        outcome: failed ? "failed" : "succeeded",
        durationSeconds:
          run.updated_at && run.run_started_at
            ? Math.max(0, (Date.parse(run.updated_at) - Date.parse(run.run_started_at)) / 1000)
            : 0,
        correlationId: run.head_sha,
      },
    }),
  ];
}
