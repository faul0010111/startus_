import { describe, expect, it } from "vitest";
import { normalize } from "../apps/signal-engine/src/normalizers/index.js";
import { CorrelationEngine, type CorrelatableEvent } from "../apps/event-processor/src/correlation/engine.js";
import { prioritize, suggestActions } from "../apps/incident-service/src/prioritization.js";
import { scoreRisk } from "../apps/risk-engine/src/scoring.js";
import { RuleEngine, catalog, findingIdFor } from "@stratus/security-rules";
import { SCENARIOS } from "../tools/event-simulator/src/scenarios/index.js";
import type { NormalizedSignal } from "@stratus/shared-types";

/**
 * Wires the real pipeline stages together in-process, without Kafka: the same
 * code paths the services run, driven by the same scenario the README tells
 * people to replay. If this fails, the demo does not do what it claims.
 */

const familyOf = (signal: NormalizedSignal): string =>
  signal.type === "deployment-event"
    ? "deployment.completed"
    : signal.type === "performance-alert"
      ? "performance.alert"
      : "infrastructure.event";

const toCorrelatable = (signal: NormalizedSignal, overrides: Partial<CorrelatableEvent> = {}): CorrelatableEvent => ({
  eventId: signal.signalId,
  eventType: familyOf(signal),
  resourceId: signal.resourceId,
  service: signal.service,
  environment: signal.environment,
  correlationId: String(signal.attributes.correlationId ?? signal.resourceId),
  severity: signal.severity,
  observedAt: signal.observedAt,
  summary: signal.title,
  ...overrides,
});

describe("end-to-end pipeline (in-process)", () => {
  it("turns the deployment-incident scenario into a single P1 with a timeline", () => {
    const scenario = SCENARIOS["deployment-incident"];
    const engine = new RuleEngine(catalog);
    const correlator = new CorrelationEngine({ windowMs: 15 * 60_000 });

    const findingIds: string[] = [];
    let cluster: ReturnType<CorrelationEngine["ingest"]> = null;

    // Drive the scenario the way the simulator does: tick until it stops emitting.
    for (let tick = 0; tick < 8 && !cluster; tick += 1) {
      for (const message of scenario.next()) {
        const signals = normalize(message.source, message.body);
        for (const signal of signals) {
          // Security engine: evaluate the rule catalog against the signal.
          const evaluations = engine.evaluate({
            signal,
            asset: {
              id: signal.resourceId,
              name: signal.service,
              kind: signal.resourceId.startsWith("k8s:") ? "kubernetes-workload" : "api-service",
              internetExposed: true,
              criticality: "tier-0",
              environment: signal.environment,
              tags: {},
            },
            configuration: signal.attributes,
          });

          cluster = correlator.ingest(toCorrelatable(signal)) ?? cluster;

          for (const evaluation of evaluations) {
            const findingId = findingIdFor(evaluation.rule.id, signal.resourceId);
            findingIds.push(findingId);
            cluster =
              correlator.ingest(
                toCorrelatable(signal, {
                  eventId: findingId,
                  eventType: "security.finding",
                  severity: evaluation.severity,
                  summary: evaluation.rule.title,
                  findingIds: [findingId],
                }),
              ) ?? cluster;
          }
        }
      }
    }

    expect(cluster, "the scenario should produce a correlated cluster").not.toBeNull();
    expect(cluster!.members.length).toBeGreaterThanOrEqual(2);
    expect(cluster!.confidence).toBeGreaterThan(0.5);

    const worst = cluster!.members.some((m) => m.severity === "critical") ? "critical" : "high";
    const assessment = scoreRisk({
      subjectId: cluster!.correlationKey,
      subjectType: "incident",
      severity: worst,
      criticality: "tier-0",
      environment: "production",
      internetExposed: true,
      ageDays: 0,
      relatedFindings: cluster!.findingIds.length,
      historicalIncidents: 0,
    });

    const priority = prioritize({
      riskScore: assessment.score,
      confidence: cluster!.confidence,
      environment: "production",
      internetExposed: true,
      affectedAssets: cluster!.assetIds.length,
    });

    expect(priority).toBe("P1");

    const actions = suggestActions({
      hypothesis: cluster!.hypothesis,
      findingIds: cluster!.findingIds,
      services: [...new Set(cluster!.members.map((m) => m.service))],
      environment: "production",
    });
    expect(actions.length).toBeGreaterThan(1);
    expect(actions.at(-1)?.id).toBe("page-owner");
  });

  it("detects the privileged workload the Kubernetes scenario introduces", () => {
    const engine = new RuleEngine(catalog);
    const [signal] = normalize("kubernetes", {
      metadata: { namespace: "checkout", labels: { environment: "production" } },
      involvedObject: { kind: "Deployment", name: "checkout" },
      reason: "PolicyViolation",
      type: "Warning",
      message: "Container runs privileged after the latest rollout",
      lastTimestamp: new Date().toISOString(),
      spec: { hostNetwork: true, containers: [{ name: "checkout", image: "checkout:latest", privileged: true, runAsUser: 0 }] },
    });

    const results = engine.evaluate({
      signal: signal!,
      asset: {
        id: signal!.resourceId,
        name: "checkout",
        kind: "kubernetes-workload",
        internetExposed: true,
        criticality: "tier-0",
        environment: "production",
        tags: {},
      },
      configuration: signal!.attributes,
    });

    const ids = results.map((r) => r.rule.id);
    expect(ids).toContain("K8S-PRIVILEGED-CONTAINER");
    expect(ids).toContain("K8S-HOST-NETWORK");
  });

  it("normalizes every collector payload into the same shape", () => {
    const samples: Array<[Parameters<typeof normalize>[0], unknown]> = [
      ["cloudtrail", { Records: [{ eventName: "PutBucketAcl", eventTime: new Date().toISOString(), resources: [{ ARN: "arn:aws:s3:::x" }] }] }],
      ["github-actions", { workflow_run: { id: 1, head_sha: "abc", conclusion: "success", updated_at: new Date().toISOString(), repository: { name: "checkout" } } }],
      ["prometheus", { alerts: [{ status: "firing", labels: { alertname: "HighLatency", service: "checkout", severity: "critical" }, startsAt: new Date().toISOString() }] }],
      ["kubernetes", { metadata: { namespace: "checkout" }, involvedObject: { name: "pod-1" }, lastTimestamp: new Date().toISOString() }],
    ];

    for (const [source, body] of samples) {
      const [signal] = normalize(source, body);
      expect(signal, `${source} produced no signal`).toBeDefined();
      expect(signal!.signalId).toMatch(/[0-9a-f-]{36}/);
      expect(signal!.resourceId.length).toBeGreaterThan(0);
      expect(Date.parse(signal!.observedAt)).not.toBeNaN();
      expect(["critical", "high", "medium", "low", "info"]).toContain(signal!.severity);
    }
  });
});
