import type { NormalizedSignal } from "@stratus/shared-types";
import { baseSignal } from "./index.js";

/** Accepts a Kubernetes Event object or an admission review summary. */
export function normalizeKubernetes(raw: any): NormalizedSignal[] {
  const items: any[] = raw?.items ?? [raw];
  return items.filter(Boolean).map((item) => {
    const namespace = item.metadata?.namespace ?? "default";
    const name = item.involvedObject?.name ?? item.metadata?.name ?? "unknown";
    return baseSignal({
      type: "infrastructure-event",
      source: "kubernetes",
      resourceId: `k8s:${item.cluster ?? "primary"}/${namespace}/${name}`,
      service: item.metadata?.labels?.["app.kubernetes.io/name"] ?? name,
      severity: item.type === "Warning" ? "medium" : "info",
      title: `${item.reason ?? "Event"}: ${item.message ?? name}`,
      environment: item.metadata?.labels?.environment ?? "production",
      observedAt: item.lastTimestamp ?? item.eventTime ?? new Date().toISOString(),
      attributes: {
        namespace,
        kind: item.involvedObject?.kind,
        reason: item.reason,
        containers: item.spec?.containers ?? [],
        hostNetwork: item.spec?.hostNetwork ?? false,
      },
    });
  });
}
