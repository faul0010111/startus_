import type { NormalizedSignal, Severity } from "@stratus/shared-types";
import { baseSignal } from "./index.js";

const SEVERITY_MAP: Record<string, Severity> = {
  critical: "critical",
  page: "critical",
  warning: "medium",
  info: "info",
};

/** Alertmanager webhook payload. */
export function normalizePrometheus(raw: any): NormalizedSignal[] {
  const alerts: any[] = raw?.alerts ?? [raw];
  return alerts
    .filter((a) => a && a.status !== "resolved")
    .map((alert) =>
      baseSignal({
        type: "performance-alert",
        source: "prometheus.alertmanager",
        resourceId: alert.labels?.resource_id ?? `service:${alert.labels?.service ?? "unknown"}`,
        service: alert.labels?.service ?? "unknown",
        severity: SEVERITY_MAP[alert.labels?.severity] ?? "medium",
        title: alert.annotations?.summary ?? alert.labels?.alertname ?? "Performance alert",
        environment: alert.labels?.environment ?? "production",
        observedAt: alert.startsAt ?? new Date().toISOString(),
        attributes: {
          alertId: alert.fingerprint ?? crypto.randomUUID(),
          metric: alert.labels?.alertname,
          value: Number(alert.annotations?.value ?? 0),
          threshold: Number(alert.annotations?.threshold ?? 0),
          window: alert.labels?.window ?? "5m",
        },
      }),
    );
}
