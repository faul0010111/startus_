import type { Severity } from "@stratus/shared-types";

export interface CorrelatableEvent {
  eventId: string;
  eventType: string;
  resourceId: string;
  service: string;
  environment: string;
  correlationId: string;
  severity: Severity;
  observedAt: string;
  summary: string;
  assetIds?: string[];
  findingIds?: string[];
}

export interface CorrelationCluster {
  correlationKey: string;
  members: CorrelatableEvent[];
  confidence: number;
  hypothesis: string;
  window: { from: string; to: string };
  assetIds: string[];
  findingIds: string[];
}

export interface CorrelationOptions {
  /** How far apart two signals can be and still describe the same event. */
  windowMs?: number;
  /** Minimum confidence before a cluster is worth publishing. */
  minConfidence?: number;
  /** Wall clock, injectable so tests are deterministic. */
  now?: () => number;
}

const DEFAULTS = { windowMs: 15 * 60_000, minConfidence: 0.5 };

/** Signal families the correlator reasons about. */
const family = (eventType: string): "deployment" | "performance" | "security" | "infrastructure" => {
  if (eventType.startsWith("deployment")) return "deployment";
  if (eventType.startsWith("performance")) return "performance";
  if (eventType.startsWith("security")) return "security";
  return "infrastructure";
};

/**
 * Sliding-window correlation over the shared dimensions of a signal. Two signals
 * join the same cluster when they touch the same service in the same
 * environment inside the window, or when they already share a correlation id
 * (for example a commit sha propagated by the collectors).
 *
 * Confidence rises with the number of distinct signal families involved: a
 * deployment plus a latency alert plus a new finding is a far stronger story
 * than three copies of the same alert.
 */
export class CorrelationEngine {
  private readonly buckets = new Map<string, CorrelatableEvent[]>();
  private readonly windowMs: number;
  private readonly minConfidence: number;
  private readonly now: () => number;

  constructor(options: CorrelationOptions = {}) {
    this.windowMs = options.windowMs ?? DEFAULTS.windowMs;
    this.minConfidence = options.minConfidence ?? DEFAULTS.minConfidence;
    this.now = options.now ?? (() => Date.now());
  }

  /** Returns a cluster when the incoming event completes a credible story. */
  ingest(event: CorrelatableEvent): CorrelationCluster | null {
    const key = this.keyFor(event);
    this.evict();
    const bucket = this.buckets.get(key) ?? [];
    bucket.push(event);
    this.buckets.set(key, bucket);

    const families = new Set(bucket.map((e) => family(e.eventType)));
    if (bucket.length < 2 || families.size < 2) return null;

    const confidence = this.confidenceFor(bucket, families);
    if (confidence < this.minConfidence) return null;

    const times = bucket.map((e) => Date.parse(e.observedAt)).sort((a, b) => a - b);
    return {
      correlationKey: key,
      members: [...bucket],
      confidence,
      hypothesis: hypothesisFor(families),
      window: {
        from: new Date(times[0] ?? this.now()).toISOString(),
        to: new Date(times[times.length - 1] ?? this.now()).toISOString(),
      },
      assetIds: unique(bucket.flatMap((e) => e.assetIds ?? [e.resourceId])),
      findingIds: unique(bucket.flatMap((e) => e.findingIds ?? [])),
    };
  }

  /** Explicit correlation id wins; otherwise group by service and environment. */
  private keyFor(event: CorrelatableEvent): string {
    if (event.correlationId && event.correlationId !== event.resourceId) return `corr:${event.correlationId}`;
    return `svc:${event.environment}:${event.service}`;
  }

  private confidenceFor(bucket: CorrelatableEvent[], families: Set<string>): number {
    const familyScore = Math.min(0.6, (families.size - 1) * 0.3);
    const severityScore = bucket.some((e) => e.severity === "critical")
      ? 0.25
      : bucket.some((e) => e.severity === "high")
        ? 0.15
        : 0.05;
    const proximity = this.proximityScore(bucket);
    return Math.min(1, round(0.2 + familyScore + severityScore + proximity));
  }

  /** Signals minutes apart are more likely related than signals an hour apart. */
  private proximityScore(bucket: CorrelatableEvent[]): number {
    const times = bucket.map((e) => Date.parse(e.observedAt));
    const spread = Math.max(...times) - Math.min(...times);
    return spread <= 5 * 60_000 ? 0.2 : spread <= this.windowMs / 2 ? 0.1 : 0;
  }

  private evict(): void {
    const cutoff = this.now() - this.windowMs;
    for (const [key, events] of this.buckets) {
      const kept = events.filter((e) => Date.parse(e.observedAt) >= cutoff);
      if (kept.length === 0) this.buckets.delete(key);
      else this.buckets.set(key, kept);
    }
  }

  get bucketCount(): number {
    return this.buckets.size;
  }
}

function hypothesisFor(families: Set<string>): string {
  if (families.has("deployment") && families.has("performance") && families.has("security")) {
    return "A recent deployment introduced both a performance regression and a new security exposure";
  }
  if (families.has("deployment") && families.has("performance")) {
    return "A recent deployment coincides with degraded service performance";
  }
  if (families.has("deployment") && families.has("security")) {
    return "A recent deployment changed the security posture of the service";
  }
  if (families.has("security") && families.has("performance")) {
    return "A security finding coincides with abnormal service behaviour";
  }
  return "Multiple related infrastructure signals on the same service";
}

const unique = <T>(items: T[]): T[] => [...new Set(items)];
const round = (n: number): number => Math.round(n * 100) / 100;
