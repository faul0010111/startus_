import { nowIso, type Scenario, type SimulatedMessage } from "./index.js";

/**
 * The flagship demo: a deploy lands, latency degrades, a finding appears on the
 * same service inside the correlation window. STRATUS should open one incident,
 * not three alerts.
 */
export function deploymentIncident(): Scenario {
  const service = "checkout";
  const commit = "9f2c41ab7e5d";
  let tick = 0;

  return {
    description: "Deployment, latency regression and a new finding on the same service",
    next(): SimulatedMessage[] {
      tick += 1;
      if (tick === 1) {
        return [
          {
            source: "github-actions",
            body: {
              workflow_run: {
                id: 88123401,
                name: "deploy-production",
                head_branch: "main",
                head_sha: commit,
                conclusion: "success",
                run_started_at: nowIso(-180),
                updated_at: nowIso(),
                environment: "production",
                actor: { login: "release-bot" },
                repository: { name: service },
              },
            },
          },
        ];
      }
      if (tick === 3) {
        return [
          {
            source: "prometheus",
            body: {
              alerts: [
                {
                  status: "firing",
                  fingerprint: `lat-${commit}`,
                  labels: {
                    alertname: "HighRequestLatency",
                    service,
                    environment: "production",
                    severity: "critical",
                    resource_id: `service:${service}`,
                    window: "5m",
                  },
                  annotations: { summary: "p99 latency above 1.2s", value: "1.84", threshold: "1.2" },
                  startsAt: nowIso(),
                },
              ],
            },
          },
        ];
      }
      if (tick === 5) {
        return [
          {
            source: "kubernetes",
            body: {
              metadata: { namespace: service, labels: { environment: "production", "app.kubernetes.io/name": service } },
              involvedObject: { kind: "Deployment", name: service },
              reason: "PolicyViolation",
              type: "Warning",
              message: "Container runs privileged after the latest rollout",
              lastTimestamp: nowIso(),
              spec: {
                hostNetwork: true,
                containers: [{ name: service, image: `${service}:latest`, privileged: true, runAsUser: 0 }],
              },
            },
          },
        ];
      }
      if (tick > 8) tick = 0;
      return [];
    },
  };
}
