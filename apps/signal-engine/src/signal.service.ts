import { Inject, Injectable } from "@nestjs/common";
import type { KafkaBus} from "@stratus/event-contracts";
import { TOPICS, createEvent } from "@stratus/event-contracts";
import { loadConfig } from "@stratus/config";
import { createLogger } from "@stratus/observability";
import { BUS } from "./bus.provider.js";
import { normalize, type CollectorSource } from "./normalizers/index.js";

@Injectable()
export class SignalService {
  private readonly config = loadConfig("signal-engine", 4010);
  private readonly log = createLogger("signal-engine");

  constructor(@Inject(BUS) private readonly bus: KafkaBus) {}

  /**
   * Normalize then publish. Ingestion never blocks on downstream processing:
   * the HTTP call returns as soon as the event is durable on the bus.
   */
  async ingest(source: CollectorSource, raw: unknown): Promise<string[]> {
    const signals = normalize(source, raw);
    for (const signal of signals) {
      const event = createEvent(
        {
          signalId: signal.signalId,
          type: signal.type,
          source: signal.source,
          resourceId: signal.resourceId,
          service: signal.service,
          severity: signal.severity,
          title: signal.title,
          observedAt: signal.observedAt,
          attributes: signal.attributes,
        },
        {
          eventType: "signal.received",
          source: `collector:${source}`,
          organizationId: signal.organizationId,
          projectId: signal.projectId,
          environment: signal.environment,
          correlationId: String(signal.attributes.correlationId ?? signal.resourceId),
        },
      );
      await this.bus.publish(TOPICS.signalReceived, event, signal.resourceId);
      this.log.info({ signalId: signal.signalId, type: signal.type, source }, "signal accepted");
    }
    return signals.map((s) => s.signalId);
  }
}
