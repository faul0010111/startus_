import { Injectable, type OnModuleInit } from "@nestjs/common";
import { Subject } from "rxjs";
import { KafkaBus, TOPICS, incidentCreatedPayload, findingDetectedPayload, riskScoreUpdatedPayload } from "@stratus/event-contracts";
import { loadConfig } from "@stratus/config";
import { createLogger } from "@stratus/observability";

export interface LiveEvent {
  kind: "finding" | "incident" | "risk";
  at: string;
  summary: string;
  severity?: string;
  data: unknown;
}

/**
 * Fans Kafka out to browser clients over SSE. The API never writes to the bus;
 * it only observes, which keeps the read path free of side effects.
 */
@Injectable()
export class LiveStream implements OnModuleInit {
  private readonly subject = new Subject<LiveEvent>();
  private readonly log = createLogger("stratus-api");
  readonly events$ = this.subject.asObservable();

  async onModuleInit(): Promise<void> {
    const config = loadConfig("stratus-api", 4000);
    const bus = new KafkaBus({
      clientId: "stratus-api",
      brokers: config.brokers,
      // A unique group per instance: every API replica sees every event.
      groupId: `stratus-api-sse-${process.pid}`,
      onError: (error, ctx) => this.log.error({ err: error, ...ctx }, "live stream failure"),
    });

    await bus.subscribe(TOPICS.findingDetected, findingDetectedPayload, async (event) => {
      this.subject.next({
        kind: "finding",
        at: event.timestamp,
        summary: `${event.payload.title} on ${event.payload.assetName}`,
        severity: event.payload.severity,
        data: event.payload,
      });
    });

    await bus.subscribe(TOPICS.incidentCreated, incidentCreatedPayload, async (event) => {
      this.subject.next({
        kind: "incident",
        at: event.timestamp,
        summary: `${event.payload.priority} ${event.payload.title}`,
        severity: event.payload.priority === "P1" ? "critical" : "high",
        data: event.payload,
      });
    });

    await bus.subscribe(TOPICS.riskScoreUpdated, riskScoreUpdatedPayload, async (event) => {
      this.subject.next({
        kind: "risk",
        at: event.timestamp,
        summary: `Risk ${event.payload.band} (${event.payload.score}) for ${event.payload.subjectId}`,
        data: event.payload,
      });
    });
  }
}
