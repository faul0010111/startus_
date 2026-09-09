import { steadyState } from "./steady-state.js";
import { deploymentIncident } from "./deployment-incident.js";
import { exposedBucket } from "./exposed-bucket.js";
import { credentialLeak } from "./credential-leak.js";

export interface SimulatedMessage {
  source: "cloudtrail" | "kubernetes" | "github-actions" | "prometheus";
  body: unknown;
}

export interface Scenario {
  description: string;
  /** Called on every tick; may return zero or several messages. */
  next: () => SimulatedMessage[];
}

export const SCENARIOS = {
  "steady-state": steadyState(),
  "deployment-incident": deploymentIncident(),
  "exposed-bucket": exposedBucket(),
  "credential-leak": credentialLeak(),
} satisfies Record<string, Scenario>;

export type ScenarioName = keyof typeof SCENARIOS;

export const SERVICES = ["checkout", "payments", "identity", "catalog", "gateway"] as const;
export const nowIso = (offsetSeconds = 0): string => new Date(Date.now() + offsetSeconds * 1000).toISOString();
export const choose = <T>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)] as T;
