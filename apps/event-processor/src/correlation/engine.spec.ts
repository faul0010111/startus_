import { describe, expect, it } from "vitest";
import { CorrelationEngine, type CorrelatableEvent } from "./engine.js";

const at = (minutesAgo: number): string => new Date(Date.now() - minutesAgo * 60_000).toISOString();

const event = (over: Partial<CorrelatableEvent>): CorrelatableEvent => ({
  eventId: crypto.randomUUID(),
  eventType: "infrastructure.event",
  resourceId: "service:checkout",
  service: "checkout",
  environment: "production",
  correlationId: "service:checkout",
  severity: "medium",
  observedAt: at(1),
  summary: "something happened",
  ...over,
});

describe("CorrelationEngine", () => {
  it("does not cluster a single signal", () => {
    const engine = new CorrelationEngine();
    expect(engine.ingest(event({ eventType: "deployment.completed" }))).toBeNull();
  });

  it("does not cluster repeats of the same signal family", () => {
    const engine = new CorrelationEngine();
    engine.ingest(event({ eventType: "performance.alert" }));
    expect(engine.ingest(event({ eventType: "performance.alert" }))).toBeNull();
  });

  it("clusters a deployment followed by a latency alert on the same service", () => {
    const engine = new CorrelationEngine();
    engine.ingest(event({ eventType: "deployment.completed", observedAt: at(4) }));
    const cluster = engine.ingest(event({ eventType: "performance.alert", severity: "high", observedAt: at(2) }));

    expect(cluster).not.toBeNull();
    expect(cluster?.members).toHaveLength(2);
    expect(cluster?.hypothesis).toMatch(/deployment/i);
    expect(cluster?.confidence).toBeGreaterThan(0.5);
  });

  it("raises confidence as more signal families join", () => {
    const two = new CorrelationEngine();
    two.ingest(event({ eventType: "deployment.completed", observedAt: at(4) }));
    const pair = two.ingest(event({ eventType: "performance.alert", severity: "high", observedAt: at(3) }));

    const three = new CorrelationEngine();
    three.ingest(event({ eventType: "deployment.completed", observedAt: at(4) }));
    three.ingest(event({ eventType: "performance.alert", severity: "high", observedAt: at(3) }));
    const triple = three.ingest(
      event({ eventType: "security.finding", severity: "critical", observedAt: at(2), findingIds: ["fnd_1"] }),
    );

    expect(triple!.confidence).toBeGreaterThan(pair!.confidence);
    expect(triple!.findingIds).toEqual(["fnd_1"]);
  });

  it("keeps unrelated services apart", () => {
    const engine = new CorrelationEngine();
    engine.ingest(event({ eventType: "deployment.completed", service: "checkout", correlationId: "service:checkout" }));
    const other = engine.ingest(
      event({ eventType: "performance.alert", service: "search", resourceId: "service:search", correlationId: "service:search" }),
    );
    expect(other).toBeNull();
    expect(engine.bucketCount).toBe(2);
  });

  it("groups by shared correlation id across resources", () => {
    const engine = new CorrelationEngine();
    engine.ingest(event({ eventType: "deployment.completed", correlationId: "sha:9f2c41", resourceId: "service:checkout" }));
    const cluster = engine.ingest(
      event({ eventType: "security.finding", correlationId: "sha:9f2c41", resourceId: "image:checkout", severity: "critical" }),
    );
    expect(cluster?.correlationKey).toBe("corr:sha:9f2c41");
    expect(cluster?.assetIds).toContain("image:checkout");
  });

  it("drops signals that fall outside the window", () => {
    const engine = new CorrelationEngine({ windowMs: 5 * 60_000 });
    engine.ingest(event({ eventType: "deployment.completed", observedAt: at(60) }));
    const cluster = engine.ingest(event({ eventType: "performance.alert", observedAt: at(0) }));
    expect(cluster).toBeNull();
  });
});
