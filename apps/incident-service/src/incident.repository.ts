import { Injectable } from "@nestjs/common";
import { Pool } from "pg";
import { loadConfig } from "@stratus/config";
import type { Incident } from "@stratus/shared-types";

/**
 * Incidents are the one artifact that must survive a broker replay, so they are
 * written to Postgres rather than kept in the stream state.
 */
@Injectable()
export class IncidentRepository {
  private readonly pool = new Pool({ connectionString: loadConfig("incident-service", 4050).POSTGRES_URL });

  async upsert(incident: Incident): Promise<void> {
    await this.pool.query(
      `INSERT INTO incidents (id, organization_id, project_id, title, priority, status, environment,
                              risk_score, confidence, correlation_id, related_asset_ids, related_finding_ids,
                              timeline, suggested_actions, opened_at, closed_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       ON CONFLICT (id) DO UPDATE SET
         priority = EXCLUDED.priority,
         status = EXCLUDED.status,
         risk_score = EXCLUDED.risk_score,
         confidence = EXCLUDED.confidence,
         related_asset_ids = EXCLUDED.related_asset_ids,
         related_finding_ids = EXCLUDED.related_finding_ids,
         timeline = EXCLUDED.timeline,
         suggested_actions = EXCLUDED.suggested_actions,
         closed_at = EXCLUDED.closed_at`,
      [
        incident.id,
        incident.organizationId,
        incident.projectId,
        incident.title,
        incident.priority,
        incident.status,
        incident.environment,
        incident.riskScore,
        incident.confidence,
        incident.correlationId,
        incident.relatedAssetIds,
        incident.relatedFindingIds,
        JSON.stringify(incident.timeline),
        JSON.stringify(incident.suggestedActions),
        incident.openedAt,
        incident.closedAt ?? null,
      ],
    );
  }

  async findByCorrelationKey(correlationId: string): Promise<Incident | null> {
    const { rows } = await this.pool.query(
      `SELECT * FROM incidents WHERE correlation_id = $1 AND status <> 'closed' ORDER BY opened_at DESC LIMIT 1`,
      [correlationId],
    );
    return rows[0] ? mapRow(rows[0]) : null;
  }
}

function mapRow(row: Record<string, any>): Incident {
  return {
    id: row.id,
    organizationId: row.organization_id,
    projectId: row.project_id,
    title: row.title,
    priority: row.priority,
    status: row.status,
    environment: row.environment,
    riskScore: Number(row.risk_score),
    confidence: Number(row.confidence),
    correlationId: row.correlation_id,
    relatedAssetIds: row.related_asset_ids ?? [],
    relatedFindingIds: row.related_finding_ids ?? [],
    timeline: row.timeline ?? [],
    suggestedActions: row.suggested_actions ?? [],
    openedAt: new Date(row.opened_at).toISOString(),
    closedAt: row.closed_at ? new Date(row.closed_at).toISOString() : undefined,
  };
}
