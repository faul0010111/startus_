import { Injectable } from "@nestjs/common";
import type {
  Asset,
  AssetSummary,
  FindingSummary,
  Incident,
  IncidentSummary,
  RiskTrend,
  SecurityFinding,
  SecurityScore,
  TimeWindow,
  Trend,
} from "@stratus/shared-types";
import { TIME_WINDOW_HOURS } from "@stratus/shared-types";
import type { Database } from "../db/database.js";

const ORG = process.env.STRATUS_ORG_ID ?? "org_demo";

@Injectable()
export class ReadModel {
  constructor(private readonly db: Database) {}

  async assetSummary(): Promise<AssetSummary> {
    const [totals] = await this.db.query<{ total: string; healthy: string; at_risk: string; critical: string }>(
      `SELECT count(*) AS total,
              count(*) FILTER (WHERE health = 'healthy')  AS healthy,
              count(*) FILTER (WHERE health = 'at-risk')  AS at_risk,
              count(*) FILTER (WHERE health = 'critical') AS critical
       FROM assets WHERE organization_id = $1`,
      [ORG],
    );
    const byEnv = await this.db.query<{ environment: string; count: string }>(
      `SELECT environment, count(*) FROM assets WHERE organization_id = $1 GROUP BY environment`,
      [ORG],
    );
    const byProvider = await this.db.query<{ provider: string; count: string }>(
      `SELECT provider, count(*) FROM assets WHERE organization_id = $1 GROUP BY provider`,
      [ORG],
    );
    return {
      total: Number(totals?.total ?? 0),
      healthy: Number(totals?.healthy ?? 0),
      atRisk: Number(totals?.at_risk ?? 0),
      critical: Number(totals?.critical ?? 0),
      byEnvironment: tally(byEnv, "environment"),
      byProvider: tally(byProvider, "provider"),
    } as AssetSummary;
  }

  async findingSummary(): Promise<FindingSummary> {
    const [row] = await this.db.query<Record<string, string>>(
      `SELECT count(*) FILTER (WHERE severity = 'critical' AND status = 'open') AS critical,
              count(*) FILTER (WHERE severity = 'high'     AND status = 'open') AS high,
              count(*) FILTER (WHERE severity = 'medium'   AND status = 'open') AS medium,
              count(*) FILTER (WHERE severity = 'low'      AND status = 'open') AS low,
              count(*) FILTER (WHERE severity = 'info'     AND status = 'open') AS info,
              count(*) FILTER (WHERE status = 'open') AS open,
              count(*) FILTER (WHERE resolved_at > now() - interval '7 days') AS resolved
       FROM findings WHERE organization_id = $1`,
      [ORG],
    );
    return {
      critical: Number(row?.critical ?? 0),
      high: Number(row?.high ?? 0),
      medium: Number(row?.medium ?? 0),
      low: Number(row?.low ?? 0),
      info: Number(row?.info ?? 0),
      open: Number(row?.open ?? 0),
      resolvedLast7d: Number(row?.resolved ?? 0),
    };
  }

  async incidentSummary(): Promise<IncidentSummary> {
    const [row] = await this.db.query<Record<string, string>>(
      `SELECT count(*) FILTER (WHERE priority = 'P1' AND status <> 'closed') AS p1,
              count(*) FILTER (WHERE priority = 'P2' AND status <> 'closed') AS p2,
              count(*) FILTER (WHERE priority = 'P3' AND status <> 'closed') AS p3,
              count(*) FILTER (WHERE priority = 'P4' AND status <> 'closed') AS p4,
              avg(EXTRACT(EPOCH FROM (opened_at - (timeline->0->>'at')::timestamptz)) / 60)
                FILTER (WHERE jsonb_array_length(timeline) > 0) AS mttd
       FROM incidents WHERE organization_id = $1`,
      [ORG],
    );
    return {
      p1: Number(row?.p1 ?? 0),
      p2: Number(row?.p2 ?? 0),
      p3: Number(row?.p3 ?? 0),
      p4: Number(row?.p4 ?? 0),
      meanTimeToDetectMinutes: row?.mttd ? Math.round(Number(row.mttd)) : null,
    };
  }

  /**
   * Posture score: 100 minus the organization risk. Computed from the latest
   * snapshot so the console and the alerting rules read the same number.
   */
  async securityScore(): Promise<SecurityScore> {
    const rows = await this.db.query<{ bucket: string; score: string }>(
      `SELECT bucket, avg(score) AS score
       FROM risk_snapshots
       WHERE organization_id = $1 AND bucket > now() - interval '48 hours'
       GROUP BY bucket ORDER BY bucket DESC LIMIT 48`,
      [ORG],
    );
    const latest = Number(rows[0]?.score ?? 0);
    const previous = Number(rows[Math.min(rows.length - 1, 24)]?.score ?? latest);
    const changePercent = previous === 0 ? 0 : round(((latest - previous) / previous) * 100);
    return {
      score: round(100 - latest),
      band: latest >= 85 ? "severe" : latest >= 70 ? "high" : latest >= 50 ? "elevated" : latest >= 30 ? "moderate" : "low",
      changePercent,
      direction: directionFor(changePercent),
      computedAt: new Date().toISOString(),
    };
  }

  async riskTrend(window: TimeWindow): Promise<RiskTrend> {
    const hours = TIME_WINDOW_HOURS[window];
    const bucketWidth = hours <= 24 ? "1 hour" : hours <= 168 ? "6 hours" : "1 day";
    const rows = await this.db.query<{ bucket: string; score: string; findings: string; incidents: string }>(
      `SELECT date_bin($2::interval, bucket, now() - ($3 || ' hours')::interval) AS bucket,
              avg(score) AS score, sum(open_findings) AS findings, sum(open_incidents) AS incidents
       FROM risk_snapshots
       WHERE organization_id = $1 AND bucket > now() - ($3 || ' hours')::interval
       GROUP BY 1 ORDER BY 1`,
      [ORG, bucketWidth, String(hours)],
    );
    const points = rows.map((r) => ({
      bucket: new Date(r.bucket).toISOString(),
      score: round(Number(r.score)),
      findings: Number(r.findings),
      incidents: Number(r.incidents),
    }));
    const first = points[0]?.score ?? 0;
    const last = points[points.length - 1]?.score ?? first;
    const changePercent = first === 0 ? 0 : round(((last - first) / first) * 100);
    return { window, direction: directionFor(changePercent), changePercent, points };
  }

  async assets(limit = 50, offset = 0): Promise<Asset[]> {
    const rows = await this.db.query<Record<string, any>>(
      `SELECT * FROM assets WHERE organization_id = $1 ORDER BY risk_score DESC LIMIT $2 OFFSET $3`,
      [ORG, limit, offset],
    );
    return rows.map(mapAsset);
  }

  async findings(filter: { severity?: string; status?: string; limit?: number }): Promise<SecurityFinding[]> {
    const rows = await this.db.query<Record<string, any>>(
      `SELECT * FROM findings
       WHERE organization_id = $1
         AND ($2::text IS NULL OR severity = $2)
         AND ($3::text IS NULL OR status = $3)
       ORDER BY risk_score DESC, first_seen_at DESC
       LIMIT $4`,
      [ORG, filter.severity ?? null, filter.status ?? null, filter.limit ?? 100],
    );
    return rows.map(mapFinding);
  }

  async incidents(status?: string): Promise<Incident[]> {
    const rows = await this.db.query<Record<string, any>>(
      `SELECT * FROM incidents
       WHERE organization_id = $1 AND ($2::text IS NULL OR status = $2)
       ORDER BY (priority = 'P1') DESC, risk_score DESC, opened_at DESC
       LIMIT 100`,
      [ORG, status ?? null],
    );
    return rows.map(mapIncident);
  }

  async incident(id: string): Promise<Incident | null> {
    const [row] = await this.db.query<Record<string, any>>(`SELECT * FROM incidents WHERE id = $1`, [id]);
    return row ? mapIncident(row) : null;
  }
}

const round = (n: number): number => Math.round(n * 10) / 10;

const directionFor = (changePercent: number): Trend =>
  changePercent > 3 ? "degrading" : changePercent < -3 ? "improving" : "stable";

const tally = (rows: Array<Record<string, string>>, key: string): Record<string, number> =>
  Object.fromEntries(rows.map((r) => [r[key] as string, Number(r.count)]));

const mapAsset = (row: Record<string, any>): Asset => ({
  id: row.id,
  organizationId: row.organization_id,
  projectId: row.project_id,
  externalId: row.external_id,
  name: row.name,
  kind: row.kind,
  provider: row.provider,
  environment: row.environment,
  region: row.region,
  criticality: row.criticality,
  internetExposed: row.internet_exposed,
  service: row.service,
  owner: row.owner,
  tags: row.tags ?? {},
  health: row.health,
  riskScore: Number(row.risk_score),
  discoveredAt: new Date(row.discovered_at).toISOString(),
  lastSeenAt: new Date(row.last_seen_at).toISOString(),
});

const mapFinding = (row: Record<string, any>): SecurityFinding => ({
  id: row.id,
  organizationId: row.organization_id,
  projectId: row.project_id,
  ruleId: row.rule_id,
  title: row.title,
  description: row.description,
  category: row.category,
  severity: row.severity,
  status: row.status,
  assetId: row.asset_id,
  assetName: row.asset_name,
  environment: row.environment,
  internetExposed: row.internet_exposed,
  riskScore: Number(row.risk_score),
  remediation: row.remediation,
  references: row.references_urls ?? [],
  compliance: row.compliance ?? [],
  evidence: row.evidence ?? {},
  firstSeenAt: new Date(row.first_seen_at).toISOString(),
  lastSeenAt: new Date(row.last_seen_at).toISOString(),
  resolvedAt: row.resolved_at ? new Date(row.resolved_at).toISOString() : undefined,
});

const mapIncident = (row: Record<string, any>): Incident => ({
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
});
