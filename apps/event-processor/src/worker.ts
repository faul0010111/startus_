import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";
import type {
  KafkaBus} from "@stratus/event-contracts";
import {
  TOPICS,
  createEvent,
  signalReceivedPayload,
  findingDetectedPayload,
} from "@stratus/event-contracts";
import { createLogger, processingDuration } from "@stratus/observability";
import { BUS } from "./bus.provider.js";
import { CorrelationEngine, type CorrelatableEvent } from "./correlation/engine.js";

@Injectable()
export class ProcessorWorker implements OnModuleInit {
  private readonly log = createLogger("event-processor");
  private readonly correlation = new CorrelationEngine({ windowMs: 15 * 60_000 });

  constructor(@Inject(BUS) private readonly bus: KafkaBus) {}

  async onModuleInit(): Promise<void> {
    await this.bus.subscribe(TOPICS.signalReceived, signalReceivedPayload, async (event) => {
      const stop = processingDuration.startTimer({ service: "event-processor", topic: TOPICS.signalReceived });
      try {
        await this.correlate(
          {
            eventId: event.eventId,
            eventType: eventTypeFor(event.payload.type),
            resourceId: event.payload.resourceId,
            service: event.payload.service,
            environment: event.environment,
            correlationId: event.correlationId,
            severity: event.payload.severity,
            observedAt: event.payload.observedAt,
            summary: event.payload.title,
          },
          event,
        );
      } finally {
        stop();
      }
    });

    await this.bus.subscribe(TOPICS.findingDetected, findingDetectedPayload, async (event) => {
      await this.correlate(
        {
          eventId: event.eventId,
          eventType: "security.finding",
          resourceId: event.payload.assetId,
          service: event.payload.assetName,
          environment: event.environment,
          correlationId: event.correlationId,
          severity: event.payload.severity,
          observedAt: event.payload.firstSeenAt,
          summary: event.payload.title,
          assetIds: [event.payload.assetId],
          findingIds: [event.payload.findingId],
        },
        event,
      );
    });
  }

  private async correlate(
    candidate: CorrelatableEvent,
    source: { organizationId: string; projectId: string; environment: string; correlationId: string },
  ): Promise<void> {
    const cluster = this.correlation.ingest(candidate);
    if (!cluster) return;

    await this.bus.publish(
      TOPICS.correlationDetected,
      createEvent(
        {
          correlationKey: cluster.correlationKey,
          window: cluster.window,
          confidence: cluster.confidence,
          hypothesis: cluster.hypothesis,
          members: cluster.members.map((m) => ({
            eventId: m.eventId,
            eventType: m.eventType,
            resourceId: m.resourceId,
            service: m.service,
            severity: m.severity,
            observedAt: m.observedAt,
            summary: m.summary,
          })),
          assetIds: cluster.assetIds,
          findingIds: cluster.findingIds,
        },
        {
          eventType: "correlation.detected",
          source: "event-processor",
          organizationId: source.organizationId,
          projectId: source.projectId,
          environment: source.environment,
          correlationId: source.correlationId,
        },
      ),
      cluster.correlationKey,
    );
    this.log.info(
      { key: cluster.correlationKey, members: cluster.members.length, confidence: cluster.confidence },
      "correlation detected",
    );
  }
}

const eventTypeFor = (signalType: string): string => {
  if (signalType === "deployment-event") return "deployment.completed";
  if (signalType === "performance-alert") return "performance.alert";
  if (signalType === "security-finding") return "security.finding";
  return "infrastructure.event";
};
