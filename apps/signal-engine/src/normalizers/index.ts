import type { NormalizedSignal } from "@stratus/shared-types";
import { normalizeCloudTrail } from "./cloudtrail.js";
import { normalizeKubernetes } from "./kubernetes.js";
import { normalizeGithubActions } from "./github-actions.js";
import { normalizePrometheus } from "./prometheus.js";

export const SUPPORTED_SOURCES = ["cloudtrail", "kubernetes", "github-actions", "prometheus"] as const;
export type CollectorSource = (typeof SUPPORTED_SOURCES)[number];

const NORMALIZERS: Record<CollectorSource, (raw: any) => NormalizedSignal[]> = {
  cloudtrail: normalizeCloudTrail,
  kubernetes: normalizeKubernetes,
  "github-actions": normalizeGithubActions,
  prometheus: normalizePrometheus,
};

export function normalize(source: CollectorSource, raw: unknown): NormalizedSignal[] {
  return NORMALIZERS[source](raw);
}

export const baseSignal = (over: Partial<NormalizedSignal>): NormalizedSignal => ({
  signalId: crypto.randomUUID(),
  type: "infrastructure-event",
  source: "unknown",
  organizationId: process.env.STRATUS_ORG_ID ?? "org_demo",
  projectId: process.env.STRATUS_PROJECT_ID ?? "proj_demo",
  environment: "production",
  resourceId: "unknown",
  service: "unknown",
  severity: "info",
  title: "Signal",
  observedAt: new Date().toISOString(),
  receivedAt: new Date().toISOString(),
  attributes: {},
  ...over,
});
