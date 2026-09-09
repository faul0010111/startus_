import type { Environment, Severity } from "./common.js";

export type IncidentPriority = "P1" | "P2" | "P3" | "P4";
export type IncidentStatus = "open" | "investigating" | "mitigated" | "closed";

export interface IncidentTimelineEntry {
  at: string;
  eventType: string;
  summary: string;
  source: string;
  severity?: Severity;
}

export interface SuggestedAction {
  id: string;
  title: string;
  rationale: string;
  automatable: boolean;
}

export interface Incident {
  id: string;
  organizationId: string;
  projectId: string;
  title: string;
  priority: IncidentPriority;
  status: IncidentStatus;
  environment: Environment;
  riskScore: number;
  /** 0-1 confidence that the correlated signals describe one real incident. */
  confidence: number;
  correlationId: string;
  relatedAssetIds: string[];
  relatedFindingIds: string[];
  timeline: IncidentTimelineEntry[];
  suggestedActions: SuggestedAction[];
  openedAt: string;
  closedAt?: string;
}

export interface IncidentSummary {
  p1: number;
  p2: number;
  p3: number;
  p4: number;
  meanTimeToDetectMinutes: number | null;
}
