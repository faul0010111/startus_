import type { Environment, Severity } from "./common.js";

export const SIGNAL_TYPES = [
  "infrastructure-event",
  "security-finding",
  "deployment-event",
  "performance-alert",
  "application-event",
  "audit-event",
] as const;
export type SignalType = (typeof SIGNAL_TYPES)[number];

/** Normalized shape every collector must produce before publishing to the bus. */
export interface NormalizedSignal {
  signalId: string;
  type: SignalType;
  source: string;
  organizationId: string;
  projectId: string;
  environment: Environment;
  resourceId: string;
  service: string;
  severity: Severity;
  title: string;
  observedAt: string;
  receivedAt: string;
  attributes: Record<string, unknown>;
}
