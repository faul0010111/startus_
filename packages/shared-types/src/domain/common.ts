/** Environments a signal can originate from, ordered by blast radius. */
export const ENVIRONMENTS = ["production", "staging", "development", "sandbox"] as const;
export type Environment = (typeof ENVIRONMENTS)[number];

/** Environment weighting used by the risk engine: production failures cost more. */
export const ENVIRONMENT_MULTIPLIER: Record<Environment, number> = {
  production: 1.4,
  staging: 1.0,
  development: 0.7,
  sandbox: 0.5,
};

export const SEVERITIES = ["critical", "high", "medium", "low", "info"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const SEVERITY_WEIGHT: Record<Severity, number> = {
  critical: 40,
  high: 28,
  medium: 16,
  low: 8,
  info: 2,
};

export const CLOUD_PROVIDERS = ["aws", "azure", "gcp", "on-prem"] as const;
export type CloudProvider = (typeof CLOUD_PROVIDERS)[number];

export interface Tenant {
  organizationId: string;
  projectId: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export type Trend = "improving" | "stable" | "degrading";
export type TimeWindow = "24h" | "7d" | "30d" | "90d";

export const TIME_WINDOW_HOURS: Record<TimeWindow, number> = {
  "24h": 24,
  "7d": 24 * 7,
  "30d": 24 * 30,
  "90d": 24 * 90,
};
