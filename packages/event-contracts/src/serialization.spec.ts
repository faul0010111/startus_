import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createEvent } from "./envelope.js";
import { encode, decode, ContractViolationError } from "./serialization.js";
import { signalReceivedPayload } from "./payloads.js";
import { TOPIC_SPECS, TOPICS, dlqTopic } from "./topics.js";

const payload = {
  signalId: "sig_1",
  type: "deployment-event" as const,
  source: "github.actions",
  resourceId: "service:checkout",
  service: "checkout",
  severity: "info" as const,
  title: "Deployment completed",
  observedAt: new Date().toISOString(),
  attributes: {},
};

describe("event envelope", () => {
  it("round-trips a valid event", () => {
    const event = createEvent(payload, {
      eventType: "signal.received",
      source: "collector:github-actions",
      organizationId: "org_demo",
      projectId: "proj_demo",
      environment: "production",
    });
    const decoded = decode(TOPICS.signalReceived, encode(event), signalReceivedPayload);
    expect(decoded.eventId).toBe(event.eventId);
    expect(decoded.payload.service).toBe("checkout");
  });

  it("rejects an event whose payload breaks the contract", () => {
    const event = createEvent({ ...payload, severity: "catastrophic" }, {
      eventType: "signal.received",
      source: "collector:test",
      organizationId: "org_demo",
      projectId: "proj_demo",
      environment: "production",
    });
    expect(() => decode(TOPICS.signalReceived, encode(event as never), signalReceivedPayload)).toThrow(
      ContractViolationError,
    );
  });

  it("rejects an unknown environment", () => {
    const event = createEvent(payload, {
      eventType: "signal.received",
      source: "collector:test",
      organizationId: "org_demo",
      projectId: "proj_demo",
      environment: "prod",
    });
    expect(() => decode(TOPICS.signalReceived, encode(event), signalReceivedPayload)).toThrow(ContractViolationError);
  });

  it("names a dead-letter topic for every declared topic", () => {
    for (const spec of TOPIC_SPECS) {
      expect(dlqTopic(spec.topic)).toBe(`${spec.topic}.dlq`);
      expect(spec.partitions).toBeGreaterThan(0);
    }
  });

  it("declares a spec for every topic in the contract", () => {
    const declared = new Set(TOPIC_SPECS.map((s) => s.topic));
    for (const topic of Object.values(TOPICS)) expect(declared.has(topic)).toBe(true);
  });

  it("validates the payload schema itself", () => {
    expect(signalReceivedPayload.safeParse({ ...payload, attributes: undefined }).success).toBe(true);
    expect(z.object({}).safeParse({}).success).toBe(true);
  });
});
