import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";
import type { KafkaBus} from "@stratus/event-contracts";
import { TOPICS, createEvent, correlationDetectedPayload } from "@stratus/event-contracts";
import { createLogger } from "@stratus/observability";
import type { Environment, Incident, IncidentTimelineEntry } from "@stratus/shared-types";
import { BUS } from "./bus.provider.js";
import type { IncidentRepository } from "./incident.repository.js";
import { prioritize, suggestActions } from "./prioritization.js";

@Injectable()
export class IncidentWorker implements OnModuleInit {
  private readonly log = createLogger("incident-service");

  constructor(
    @Inject(BUS) private readonly bus: KafkaBus,
    private readonly repository: IncidentRepository,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.bus.subscribe(TOPICS.correlationDetected, correlationDetectedPayload, async (event) => {
      const payload = event.payload;
      const existing = await this.repository.findByCorrelationKey(payload.correlationKey);

      const timeline: IncidentTimelineEntry[] = payload.members
        .map((m) => ({
          at: m.observedAt,
          eventType: m.eventType,
          summary: m.summary,
          source: m.service,
          severity: m.severity,
        }))
        .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));

      const riskScore = riskFromMembers(payload.members.map((m) => m.severity));
      const priority = prioritize({
        riskScore,
        confidence: payload.confidence,
        environment: event.environment,
        internetExposed: false,
        affectedAssets: payload.assetIds.length,
      });

      const incident: Incident = {
        id: existing?.id ?? `inc_${payload.correlationKey.replace(/[^a-zA-Z0-9]+/g, "-")}-${Date.now().toString(36)}`,
        organizationId: event.organizationId,
        projectId: event.projectId,
        title: payload.hypothesis,
        priority,
        status: existing?.status ?? "open",
        environment: event.environment as Environment,
        riskScore,
        confidence: payload.confidence,
        correlationId: payload.correlationKey,
        relatedAssetIds: payload.assetIds,
        relatedFindingIds: payload.findingIds,
        timeline: [
          ...timeline,
          {
            at: new Date().toISOString(),
            eventType: existing ? "incident.updated" : "incident.created",
            summary: existing ? "New correlated signal joined this incident" : "Incident opened from correlated signals",
            source: "stratus",
          },
        ],
        suggestedActions: suggestActions({
          hypothesis: payload.hypothesis,
          findingIds: payload.findingIds,
          services: [...new Set(payload.members.map((m) => m.service))],
          environment: event.environment,
        }),
        openedAt: existing?.openedAt ?? payload.window.from,
      };

      await this.repository.upsert(incident);

      const topic = existing ? TOPICS.incidentUpdated : TOPICS.incidentCreated;
      await this.bus.publish(
        topic,
        createEvent(
          {
            incidentId: incident.id,
            title: incident.title,
            priority: incident.priority,
            environment: incident.environment,
            riskScore: incident.riskScore,
            confidence: incident.confidence,
            relatedAssetIds: incident.relatedAssetIds,
            relatedFindingIds: incident.relatedFindingIds,
            trigger: payload.correlationKey,
            ...(existing ? { status: incident.status, updateReason: "correlation extended" } : {}),
          },
          {
            eventType: existing ? "incident.updated" : "incident.created",
            source: "incident-service",
            organizationId: event.organizationId,
            projectId: event.projectId,
            environment: event.environment,
            correlationId: event.correlationId,
          },
        ),
        incident.id,
      );
      this.log.info({ incidentId: incident.id, priority: incident.priority }, existing ? "incident updated" : "incident opened");
    });
  }
}

/** Worst severity in the cluster drives the base score, extras add pressure. */
function riskFromMembers(severities: string[]): number {
  const weight: Record<string, number> = { critical: 85, high: 68, medium: 45, low: 25, info: 10 };
  const worst = Math.max(...severities.map((s) => weight[s] ?? 10));
  return Math.min(100, worst + Math.min(10, (severities.length - 1) * 2));
}
