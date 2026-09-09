import { Counter, Histogram, Gauge, Registry, collectDefaultMetrics } from "prom-client";

export const registry = new Registry();
collectDefaultMetrics({ register: registry });

export const eventsConsumed = new Counter({
  name: "stratus_events_consumed_total",
  help: "Events consumed from the bus",
  labelNames: ["service", "topic", "outcome"] as const,
  registers: [registry],
});

export const eventsProduced = new Counter({
  name: "stratus_events_produced_total",
  help: "Events published to the bus",
  labelNames: ["service", "topic"] as const,
  registers: [registry],
});

export const processingDuration = new Histogram({
  name: "stratus_event_processing_seconds",
  help: "Time spent handling a single event",
  labelNames: ["service", "topic"] as const,
  buckets: [0.005, 0.025, 0.1, 0.25, 1, 2.5, 10],
  registers: [registry],
});

export const consumerLag = new Gauge({
  name: "stratus_consumer_lag_messages",
  help: "Messages behind the head of the partition",
  labelNames: ["service", "topic", "partition"] as const,
  registers: [registry],
});

export const riskScoreGauge = new Gauge({
  name: "stratus_risk_score",
  help: "Latest computed risk score",
  labelNames: ["subject_type", "environment"] as const,
  registers: [registry],
});

export const openFindings = new Gauge({
  name: "stratus_open_findings",
  help: "Open security findings",
  labelNames: ["severity", "category", "environment"] as const,
  registers: [registry],
});

export const metricsHandler = async () => ({
  contentType: registry.contentType,
  body: await registry.metrics(),
});
