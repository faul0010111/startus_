import { Pool } from "pg";
import { loadConfig } from "@stratus/config";
import { catalog } from "@stratus/security-rules";
import { seeded, pick, between } from "./random.js";

/**
 * Builds a demo estate large enough to exercise the console: 1,247 assets with
 * a realistic long tail of findings, a handful of live incidents and 90 days of
 * hourly risk snapshots. Deterministic, so screenshots and tests match.
 */
const config = loadConfig("stratus-api", 4000);
const pool = new Pool({ connectionString: config.POSTGRES_URL });
const rng = seeded(20260907);
const ORG = process.env.STRATUS_ORG_ID ?? "org_demo";
const PROJECT = process.env.STRATUS_PROJECT_ID ?? "proj_demo";

const KINDS = [
  "cloud-storage", "database", "virtual-machine", "kubernetes-workload", "kubernetes-cluster",
  "container-image", "api-service", "serverless-function", "security-group", "iam-role", "ci-pipeline",
] as const;
const PROVIDERS = ["aws", "azure", "gcp", "on-prem"] as const;
const ENVIRONMENTS = ["production", "staging", "development", "sandbox"] as const;
const REGIONS = ["us-east-1", "us-west-2", "eu-west-1", "sa-east-1", "ap-southeast-2"] as const;
const CRITICALITY = ["tier-0", "tier-1", "tier-2", "tier-3"] as const;
const SERVICES = [
  "checkout", "payments", "identity", "catalog", "search", "notifications", "billing",
  "fulfilment", "analytics", "gateway", "media", "recommendations",
];
const OWNERS = ["platform", "payments-team", "identity-team", "data-eng", "sre", "security"];

const TOTAL_ASSETS = 1247;
const CRITICAL_ASSETS = 45;
const AT_RISK_ASSETS = 168;

async function main(): Promise<void> {
  await pool.query("TRUNCATE incidents, findings, assets, risk_snapshots RESTART IDENTITY CASCADE");

  const assets = buildAssets();
  await insertAssets(assets);

  const findings = buildFindings(assets);
  await insertFindings(findings);

  await insertIncidents(assets, findings);
  await insertSnapshots();

  console.log(`seeded ${assets.length} assets, ${findings.length} findings`);
  await pool.end();
}

function buildAssets() {
  return Array.from({ length: TOTAL_ASSETS }, (_, i) => {
    const health = i < CRITICAL_ASSETS ? "critical" : i < CRITICAL_ASSETS + AT_RISK_ASSETS ? "at-risk" : "healthy";
    const environment = health === "healthy" ? pick(rng, ENVIRONMENTS) : pick(rng, ["production", "production", "staging"] as const);
    const service = pick(rng, SERVICES);
    const kind = pick(rng, KINDS);
    return {
      id: `ast_${String(i + 1).padStart(5, "0")}`,
      externalId: `${pick(rng, PROVIDERS)}:${kind}:${service}-${i}`,
      name: `${service}-${kind.replace(/-/g, "")}-${String(i).padStart(4, "0")}`,
      kind,
      provider: pick(rng, PROVIDERS),
      environment,
      region: pick(rng, REGIONS),
      criticality: health === "critical" ? pick(rng, ["tier-0", "tier-1"] as const) : pick(rng, CRITICALITY),
      internetExposed: health !== "healthy" ? rng() < 0.55 : rng() < 0.12,
      service,
      owner: pick(rng, OWNERS),
      health,
      riskScore:
        health === "critical" ? round(between(rng, 78, 97)) : health === "at-risk" ? round(between(rng, 45, 77)) : round(between(rng, 2, 30)),
    };
  });
}

async function insertAssets(assets: ReturnType<typeof buildAssets>): Promise<void> {
  for (const batch of chunk(assets, 200)) {
    const values: unknown[] = [];
    const rows = batch.map((a, idx) => {
      const o = idx * 14;
      values.push(a.id, ORG, PROJECT, a.externalId, a.name, a.kind, a.provider, a.environment, a.region,
        a.criticality, a.internetExposed, a.service, a.owner, a.health);
      return `($${o + 1},$${o + 2},$${o + 3},$${o + 4},$${o + 5},$${o + 6},$${o + 7},$${o + 8},$${o + 9},$${o + 10},$${o + 11},$${o + 12},$${o + 13},$${o + 14})`;
    });
    await pool.query(
      `INSERT INTO assets (id, organization_id, project_id, external_id, name, kind, provider, environment,
                           region, criticality, internet_exposed, service, owner, health) VALUES ${rows.join(",")}`,
      values,
    );
  }
  for (const a of assets) {
    await pool.query("UPDATE assets SET risk_score = $2 WHERE id = $1", [a.id, a.riskScore]);
  }
}

function buildFindings(assets: ReturnType<typeof buildAssets>) {
  const findings: Array<Record<string, unknown>> = [];
  for (const asset of assets) {
    const count = asset.health === "critical" ? 3 + Math.floor(rng() * 4) : asset.health === "at-risk" ? 1 + Math.floor(rng() * 3) : rng() < 0.25 ? 1 : 0;
    for (let i = 0; i < count; i += 1) {
      const rule = pick(rng, catalog);
      const ageDays = between(rng, 0, 75);
      findings.push({
        id: `fnd_${rule.id.toLowerCase()}_${asset.id}_${i}`,
        ruleId: rule.id,
        title: rule.title,
        description: rule.description,
        category: rule.category,
        severity: asset.health === "critical" && i === 0 ? "critical" : rule.severity,
        status: rng() < 0.08 ? "resolved" : rng() < 0.06 ? "acknowledged" : "open",
        assetId: asset.id,
        assetName: asset.name,
        environment: asset.environment,
        internetExposed: asset.internetExposed,
        riskScore: round(Math.min(99, asset.riskScore + between(rng, -8, 8))),
        remediation: rule.remediation,
        compliance: rule.compliance,
        references: rule.references,
        firstSeen: new Date(Date.now() - ageDays * 86_400_000).toISOString(),
      });
    }
  }
  return findings;
}

async function insertFindings(findings: Array<Record<string, any>>): Promise<void> {
  for (const batch of chunk(findings, 150)) {
    const values: unknown[] = [];
    const rows = batch.map((f, idx) => {
      const o = idx * 17;
      values.push(f.id, ORG, PROJECT, f.ruleId, f.title, f.description, f.category, f.severity, f.status,
        f.assetId, f.assetName, f.environment, f.internetExposed, f.riskScore, f.remediation, f.compliance, f.firstSeen);
      return `($${o + 1},$${o + 2},$${o + 3},$${o + 4},$${o + 5},$${o + 6},$${o + 7},$${o + 8},$${o + 9},$${o + 10},$${o + 11},$${o + 12},$${o + 13},$${o + 14},$${o + 15},$${o + 16},$${o + 17})`;
    });
    await pool.query(
      `INSERT INTO findings (id, organization_id, project_id, rule_id, title, description, category, severity,
                             status, asset_id, asset_name, environment, internet_exposed, risk_score,
                             remediation, compliance, first_seen_at)
       VALUES ${rows.join(",")} ON CONFLICT (id) DO NOTHING`,
      values,
    );
  }
  await pool.query(`UPDATE findings SET resolved_at = first_seen_at + interval '3 days' WHERE status = 'resolved'`);
}

async function insertIncidents(assets: ReturnType<typeof buildAssets>, findings: Array<Record<string, any>>): Promise<void> {
  const shape = [
    { priority: "P1", count: 3, hypothesis: "A recent deployment introduced both a performance regression and a new security exposure" },
    { priority: "P2", count: 12, hypothesis: "A recent deployment coincides with degraded service performance" },
    { priority: "P3", count: 28, hypothesis: "A security finding coincides with abnormal service behaviour" },
  ];
  let n = 0;
  for (const group of shape) {
    for (let i = 0; i < group.count; i += 1) {
      const asset = assets[Math.floor(rng() * 200)]!;
      const related = findings.filter((f) => f.assetId === asset.id).slice(0, 3);
      const openedAt = new Date(Date.now() - between(rng, 0.5, 72) * 3_600_000);
      const timeline = [
        { at: iso(openedAt, -8), eventType: "deployment.completed", summary: `Deployment completed for ${asset.service}`, source: "github.actions" },
        { at: iso(openedAt, -6), eventType: "performance.alert", summary: "p99 latency above threshold", source: "prometheus", severity: "high" },
        { at: iso(openedAt, -5), eventType: "security.finding", summary: related[0]?.title ?? "New finding detected", source: "security-engine", severity: "critical" },
        { at: iso(openedAt, -3), eventType: "risk.score.updated", summary: "Risk score increased", source: "risk-engine" },
        { at: iso(openedAt, 0), eventType: "incident.created", summary: "Incident opened from correlated signals", source: "stratus" },
      ];
      await pool.query(
        `INSERT INTO incidents (id, organization_id, project_id, title, priority, status, environment, risk_score,
                                confidence, correlation_id, related_asset_ids, related_finding_ids, timeline,
                                suggested_actions, opened_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
        [
          `inc_${String(++n).padStart(4, "0")}`,
          ORG,
          PROJECT,
          group.hypothesis,
          group.priority,
          pick(rng, ["open", "investigating", "mitigated"] as const),
          asset.environment,
          round(group.priority === "P1" ? between(rng, 82, 96) : group.priority === "P2" ? between(rng, 60, 81) : between(rng, 35, 59)),
          round(between(rng, 0.55, 0.95)) / 1,
          `svc:${asset.environment}:${asset.service}`,
          [asset.id],
          related.map((f) => f.id),
          JSON.stringify(timeline),
          JSON.stringify([
            { id: "rollback-latest-deploy", title: `Roll back the most recent deployment of ${asset.service}`, rationale: "The incident window opens immediately after a deployment completed.", automatable: true },
            { id: "contain-exposure", title: "Remove public exposure on the affected resources", rationale: "Findings in this cluster describe reachable attack surface.", automatable: false },
          ]),
          openedAt.toISOString(),
        ],
      );
    }
  }
}

/** 90 days of hourly snapshots with a slow upward drift and a weekly rhythm. */
async function insertSnapshots(): Promise<void> {
  const now = Date.now();
  const hours = 24 * 90;
  for (let h = hours; h >= 0; h -= 1) {
    const bucket = new Date(now - h * 3_600_000);
    const drift = (hours - h) / hours;
    for (const environment of ENVIRONMENTS) {
      const base = environment === "production" ? 46 : environment === "staging" ? 32 : 22;
      const weekly = Math.sin((h / 24 / 7) * Math.PI * 2) * 3;
      const score = round(Math.max(5, Math.min(98, base + drift * 9 + weekly + between(rng, -2.5, 2.5))));
      await pool.query(
        `INSERT INTO risk_snapshots (bucket, organization_id, environment, score, open_findings, open_incidents)
         VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING`,
        [bucket.toISOString(), ORG, environment, score, Math.round(score * 4), Math.round(score / 12)],
      );
    }
  }
}

const round = (n: number): number => Math.round(n * 10) / 10;
const iso = (base: Date, offsetMinutes: number): string => new Date(base.getTime() + offsetMinutes * 60_000).toISOString();
const chunk = <T>(items: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};

await main();
