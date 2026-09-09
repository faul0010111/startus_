import type { Environment, Severity } from "./common.js";

export const FINDING_CATEGORIES = ["cloud", "kubernetes", "container", "secrets", "cicd"] as const;
export type FindingCategory = (typeof FINDING_CATEGORIES)[number];

export type FindingStatus = "open" | "acknowledged" | "suppressed" | "resolved";

export interface SecurityFinding {
  id: string;
  organizationId: string;
  projectId: string;
  ruleId: string;
  title: string;
  description: string;
  category: FindingCategory;
  severity: Severity;
  status: FindingStatus;
  assetId: string;
  assetName: string;
  environment: Environment;
  internetExposed: boolean;
  riskScore: number;
  remediation: string;
  references: string[];
  /** Control identifiers this finding maps to, e.g. "CIS-AWS-2.1.5". */
  compliance: string[];
  evidence: Record<string, unknown>;
  firstSeenAt: string;
  lastSeenAt: string;
  resolvedAt?: string;
}

export interface FindingSummary {
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
  open: number;
  resolvedLast7d: number;
}
