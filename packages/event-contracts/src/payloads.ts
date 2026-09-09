import { z } from "zod";

const environment = z.enum(["production", "staging", "development", "sandbox"]);
const severity = z.enum(["critical", "high", "medium", "low", "info"]);

export const signalReceivedPayload = z.object({
  signalId: z.string(),
  type: z.enum([
    "infrastructure-event",
    "security-finding",
    "deployment-event",
    "performance-alert",
    "application-event",
    "audit-event",
  ]),
  source: z.string(),
  resourceId: z.string(),
  service: z.string(),
  severity,
  title: z.string(),
  observedAt: z.string().datetime(),
  attributes: z.record(z.unknown()).default({}),
});
export type SignalReceivedPayload = z.infer<typeof signalReceivedPayload>;

export const assetDiscoveredPayload = z.object({
  assetId: z.string(),
  externalId: z.string(),
  name: z.string(),
  kind: z.string(),
  provider: z.enum(["aws", "azure", "gcp", "on-prem"]),
  region: z.string(),
  criticality: z.enum(["tier-0", "tier-1", "tier-2", "tier-3"]),
  internetExposed: z.boolean(),
  service: z.string(),
  owner: z.string(),
  tags: z.record(z.string()).default({}),
});
export type AssetDiscoveredPayload = z.infer<typeof assetDiscoveredPayload>;

export const findingDetectedPayload = z.object({
  findingId: z.string(),
  ruleId: z.string(),
  title: z.string(),
  description: z.string(),
  category: z.enum(["cloud", "kubernetes", "container", "secrets", "cicd"]),
  severity,
  assetId: z.string(),
  assetName: z.string(),
  internetExposed: z.boolean(),
  remediation: z.string(),
  compliance: z.array(z.string()).default([]),
  evidence: z.record(z.unknown()).default({}),
  firstSeenAt: z.string().datetime(),
});
export type FindingDetectedPayload = z.infer<typeof findingDetectedPayload>;

export const deploymentCompletedPayload = z.object({
  deploymentId: z.string(),
  service: z.string(),
  version: z.string(),
  pipeline: z.string(),
  commitSha: z.string(),
  actor: z.string(),
  targetAssetIds: z.array(z.string()).default([]),
  durationSeconds: z.number().nonnegative(),
  outcome: z.enum(["succeeded", "failed", "rolled-back"]),
});
export type DeploymentCompletedPayload = z.infer<typeof deploymentCompletedPayload>;

export const performanceAlertPayload = z.object({
  alertId: z.string(),
  service: z.string(),
  assetId: z.string(),
  metric: z.string(),
  value: z.number(),
  threshold: z.number(),
  severity,
  window: z.string(),
});
export type PerformanceAlertPayload = z.infer<typeof performanceAlertPayload>;

export const riskScoreUpdatedPayload = z.object({
  subjectId: z.string(),
  subjectType: z.enum(["asset", "finding", "incident", "organization"]),
  score: z.number().min(0).max(100),
  previousScore: z.number().min(0).max(100).nullable(),
  band: z.enum(["low", "moderate", "elevated", "high", "severe"]),
  factors: z.array(
    z.object({ name: z.string(), contribution: z.number(), detail: z.string() }),
  ),
});
export type RiskScoreUpdatedPayload = z.infer<typeof riskScoreUpdatedPayload>;

export const incidentCreatedPayload = z.object({
  incidentId: z.string(),
  title: z.string(),
  priority: z.enum(["P1", "P2", "P3", "P4"]),
  environment,
  riskScore: z.number().min(0).max(100),
  confidence: z.number().min(0).max(1),
  relatedAssetIds: z.array(z.string()),
  relatedFindingIds: z.array(z.string()),
  trigger: z.string(),
});
export type IncidentCreatedPayload = z.infer<typeof incidentCreatedPayload>;

export const incidentUpdatedPayload = incidentCreatedPayload.extend({
  status: z.enum(["open", "investigating", "mitigated", "closed"]),
  updateReason: z.string(),
});
export type IncidentUpdatedPayload = z.infer<typeof incidentUpdatedPayload>;

export const systemAlertPayload = z.object({
  component: z.string(),
  message: z.string(),
  severity,
  detail: z.record(z.unknown()).default({}),
});
export type SystemAlertPayload = z.infer<typeof systemAlertPayload>;

export const correlationDetectedPayload = z.object({
  correlationKey: z.string(),
  window: z.object({ from: z.string().datetime(), to: z.string().datetime() }),
  confidence: z.number().min(0).max(1),
  hypothesis: z.string(),
  members: z.array(
    z.object({
      eventId: z.string(),
      eventType: z.string(),
      resourceId: z.string(),
      service: z.string(),
      severity,
      observedAt: z.string().datetime(),
      summary: z.string(),
    }),
  ),
  assetIds: z.array(z.string()),
  findingIds: z.array(z.string()),
});
export type CorrelationDetectedPayload = z.infer<typeof correlationDetectedPayload>;
