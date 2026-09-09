import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";
import type {
  KafkaBus} from "@stratus/event-contracts";
import {
  TOPICS,
  createEvent,
  signalReceivedPayload,
  type FindingDetectedPayload,
} from "@stratus/event-contracts";
import { RuleEngine, catalog, findingIdFor } from "@stratus/security-rules";
import { createLogger, openFindings, processingDuration } from "@stratus/observability";
import { BUS } from "./bus.provider.js";
import type { AssetCatalog } from "./asset-catalog.js";

@Injectable()
export class SecurityEngineWorker implements OnModuleInit {
  private readonly log = createLogger("security-engine");
  private readonly engine = new RuleEngine(catalog, {
    onError: (rule, error) => this.log.error({ err: error, ruleId: rule.id }, "rule evaluation failed"),
  });

  constructor(
    @Inject(BUS) private readonly bus: KafkaBus,
    private readonly assets: AssetCatalog,
  ) {}

  async onModuleInit(): Promise<void> {
    this.log.info({ rules: this.engine.size }, "security engine ready");
    await this.bus.subscribe(TOPICS.signalReceived, signalReceivedPayload, async (event) => {
      const stop = processingDuration.startTimer({ service: "security-engine", topic: TOPICS.signalReceived });
      try {
        await this.handle(event);
      } finally {
        stop();
      }
    });
  }

  private async handle(event: Parameters<typeof this.evaluate>[0]): Promise<void> {
    const findings = await this.evaluate(event);
    for (const finding of findings) {
      await this.bus.publish(
        TOPICS.findingDetected,
        createEvent(finding, {
          eventType: "security.finding.detected",
          source: "security-engine",
          organizationId: event.organizationId,
          projectId: event.projectId,
          environment: event.environment,
          correlationId: event.correlationId,
        }),
        finding.assetId,
      );
      openFindings.inc({ severity: finding.severity, category: finding.category, environment: event.environment });
      this.log.info({ ruleId: finding.ruleId, assetId: finding.assetId }, "finding detected");
    }
  }

  private async evaluate(event: {
    organizationId: string;
    projectId: string;
    environment: string;
    correlationId: string;
    payload: { resourceId: string; attributes: Record<string, unknown>; observedAt: string } & Record<string, unknown>;
  }): Promise<FindingDetectedPayload[]> {
    const asset = await this.assets.get(event.payload.resourceId, event.environment);
    const evaluations = this.engine.evaluate({
      signal: {
        signalId: String(event.payload.signalId ?? ""),
        type: event.payload.type as never,
        source: String(event.payload.source ?? "unknown"),
        organizationId: event.organizationId,
        projectId: event.projectId,
        environment: event.environment as never,
        resourceId: event.payload.resourceId,
        service: String(event.payload.service ?? "unknown"),
        severity: event.payload.severity as never,
        title: String(event.payload.title ?? ""),
        observedAt: event.payload.observedAt,
        receivedAt: new Date().toISOString(),
        attributes: event.payload.attributes,
      },
      asset,
      configuration: event.payload.attributes,
    });

    return evaluations.map((evaluation) => ({
      findingId: findingIdFor(evaluation.rule.id, asset.id),
      ruleId: evaluation.rule.id,
      title: evaluation.rule.title,
      description: evaluation.rule.description,
      category: evaluation.rule.category,
      severity: evaluation.severity,
      assetId: asset.id,
      assetName: asset.name,
      internetExposed: asset.internetExposed,
      remediation: evaluation.rule.remediation,
      compliance: evaluation.rule.compliance,
      evidence: evaluation.evidence,
      firstSeenAt: event.payload.observedAt,
    }));
  }
}
