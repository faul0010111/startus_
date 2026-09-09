import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";
import type {
  KafkaBus} from "@stratus/event-contracts";
import {
  TOPICS,
  createEvent,
  findingDetectedPayload,
  correlationDetectedPayload,
} from "@stratus/event-contracts";
import { createLogger, riskScoreGauge } from "@stratus/observability";
import type { AssetCriticality, Environment } from "@stratus/shared-types";
import { BUS } from "./bus.provider.js";
import type { RiskStateStore } from "./state.store.js";
import { scoreRisk } from "./scoring.js";

@Injectable()
export class RiskWorker implements OnModuleInit {
  private readonly log = createLogger("risk-engine");

  constructor(
    @Inject(BUS) private readonly bus: KafkaBus,
    private readonly state: RiskStateStore,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.bus.subscribe(TOPICS.findingDetected, findingDetectedPayload, async (event) => {
      const previous = await this.state.load(event.payload.assetId);
      const assessment = scoreRisk({
        subjectId: event.payload.findingId,
        subjectType: "finding",
        severity: event.payload.severity,
        criticality: (event.payload.evidence.criticality as AssetCriticality) ?? "tier-2",
        environment: event.environment as Environment,
        internetExposed: event.payload.internetExposed,
        ageDays: (Date.now() - Date.parse(event.payload.firstSeenAt)) / 86_400_000,
        relatedFindings: previous.findingIds.length,
        historicalIncidents: previous.historicalIncidents,
      });

      const next = await this.state.recordFinding(event.payload.assetId, event.payload.findingId, assessment.score);
      riskScoreGauge.set({ subject_type: "finding", environment: event.environment }, assessment.score);

      await this.bus.publish(
        TOPICS.riskScoreUpdated,
        createEvent(
          {
            subjectId: event.payload.findingId,
            subjectType: "finding" as const,
            score: assessment.score,
            previousScore: previous.score || null,
            band: assessment.band,
            factors: assessment.factors,
          },
          {
            eventType: "risk.score.updated",
            source: "risk-engine",
            organizationId: event.organizationId,
            projectId: event.projectId,
            environment: event.environment,
            correlationId: event.correlationId,
          },
        ),
        event.payload.assetId,
      );
      this.log.info({ findingId: event.payload.findingId, score: assessment.score, assetRisk: next.score }, "risk scored");
    });

    // A correlated cluster is scored as one subject: the incident, not the parts.
    await this.bus.subscribe(TOPICS.correlationDetected, correlationDetectedPayload, async (event) => {
      const worst = event.payload.members.reduce<"critical" | "high" | "medium" | "low" | "info">((acc, m) => {
        const order = ["info", "low", "medium", "high", "critical"] as const;
        return order.indexOf(m.severity) > order.indexOf(acc) ? m.severity : acc;
      }, "info");
      const assessment = scoreRisk({
        subjectId: event.payload.correlationKey,
        subjectType: "incident",
        severity: worst,
        criticality: "tier-1",
        environment: event.environment as Environment,
        internetExposed: false,
        ageDays: 0,
        relatedFindings: event.payload.findingIds.length,
        historicalIncidents: 0,
      });
      await this.bus.publish(
        TOPICS.riskScoreUpdated,
        createEvent(
          {
            subjectId: event.payload.correlationKey,
            subjectType: "incident" as const,
            score: Math.round(assessment.score * event.payload.confidence * 10) / 10,
            previousScore: null,
            band: assessment.band,
            factors: assessment.factors,
          },
          {
            eventType: "risk.score.updated",
            source: "risk-engine",
            organizationId: event.organizationId,
            projectId: event.projectId,
            environment: event.environment,
            correlationId: event.correlationId,
          },
        ),
        event.payload.correlationKey,
      );
    });
  }
}
