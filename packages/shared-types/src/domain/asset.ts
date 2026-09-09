import type { CloudProvider, Environment } from "./common.js";

export const ASSET_KINDS = [
  "cloud-storage",
  "database",
  "virtual-machine",
  "kubernetes-workload",
  "kubernetes-cluster",
  "container-image",
  "api-service",
  "serverless-function",
  "security-group",
  "iam-role",
  "ci-pipeline",
] as const;
export type AssetKind = (typeof ASSET_KINDS)[number];

export type AssetHealth = "healthy" | "at-risk" | "critical";

/** How much the business depends on the asset. Feeds the risk score. */
export type AssetCriticality = "tier-0" | "tier-1" | "tier-2" | "tier-3";

export const CRITICALITY_MULTIPLIER: Record<AssetCriticality, number> = {
  "tier-0": 1.5,
  "tier-1": 1.25,
  "tier-2": 1.0,
  "tier-3": 0.8,
};

export interface Asset {
  id: string;
  organizationId: string;
  projectId: string;
  externalId: string;
  name: string;
  kind: AssetKind;
  provider: CloudProvider;
  environment: Environment;
  region: string;
  criticality: AssetCriticality;
  internetExposed: boolean;
  service: string;
  owner: string;
  tags: Record<string, string>;
  health: AssetHealth;
  riskScore: number;
  discoveredAt: string;
  lastSeenAt: string;
}

export interface AssetSummary {
  total: number;
  healthy: number;
  atRisk: number;
  critical: number;
  byEnvironment: Record<Environment, number>;
  byProvider: Record<CloudProvider, number>;
}
