import type { Asset, Incident, SecurityFinding, TimeWindow } from "@stratus/shared-types";
import type { Overview } from "./api";

/** Offline sample data. Mirrors the shape of the seeded database, never merged with live results. */
export function demoOverview(window: TimeWindow): Overview {
  const points = Array.from({ length: window === "24h" ? 24 : 30 }, (_, i) => ({
    bucket: new Date(Date.now() - (29 - i) * 3_600_000 * 6).toISOString(),
    score: 38 + Math.sin(i / 3) * 6 + i * 0.35,
    findings: 380 + i * 3,
    incidents: 3 + (i % 4),
  }));
  return {
    score: { score: 78, band: "high", changePercent: 12, direction: "degrading", computedAt: new Date().toISOString() },
    assets: {
      total: 1247,
      healthy: 1034,
      atRisk: 168,
      critical: 45,
      byEnvironment: { production: 612, staging: 288, development: 231, sandbox: 116 },
      byProvider: { aws: 741, azure: 244, gcp: 198, "on-prem": 64 },
    },
    findings: { critical: 45, high: 132, medium: 287, low: 164, info: 88, open: 716, resolvedLast7d: 91 },
    incidents: { p1: 3, p2: 12, p3: 28, p4: 41, meanTimeToDetectMinutes: 7 },
    trend: { window, direction: "degrading", changePercent: 12, points },
  };
}

export function demoIncidents(): Incident[] {
  const base = Date.now() - 45 * 60_000;
  return [
    {
      id: "inc_0001",
      organizationId: "org_demo",
      projectId: "proj_demo",
      title: "A recent deployment introduced both a performance regression and a new security exposure",
      priority: "P1",
      status: "investigating",
      environment: "production",
      riskScore: 91,
      confidence: 0.88,
      correlationId: "svc:production:checkout",
      relatedAssetIds: ["ast_00012", "ast_00031"],
      relatedFindingIds: ["fnd_k8s-privileged-container_ast_00012"],
      timeline: [
        { at: new Date(base).toISOString(), eventType: "deployment.completed", summary: "Deployment completed for checkout", source: "github.actions" },
        { at: new Date(base + 120_000).toISOString(), eventType: "performance.alert", summary: "p99 latency above 1.2s", source: "prometheus", severity: "high" },
        { at: new Date(base + 180_000).toISOString(), eventType: "security.finding", summary: "Workload runs a privileged container", source: "security-engine", severity: "critical" },
        { at: new Date(base + 300_000).toISOString(), eventType: "risk.score.updated", summary: "Risk score increased to 91", source: "risk-engine" },
        { at: new Date(base + 480_000).toISOString(), eventType: "incident.created", summary: "Incident opened from correlated signals", source: "stratus" },
      ],
      suggestedActions: [
        { id: "rollback-latest-deploy", title: "Roll back the most recent deployment of checkout", rationale: "The incident window opens immediately after a deployment completed.", automatable: true },
        { id: "contain-exposure", title: "Remove privileged execution from the checkout workload", rationale: "Findings in this cluster describe reachable attack surface.", automatable: false },
      ],
      openedAt: new Date(base).toISOString(),
    },
    {
      id: "inc_0002",
      organizationId: "org_demo",
      projectId: "proj_demo",
      title: "A security finding coincides with abnormal service behaviour",
      priority: "P2",
      status: "open",
      environment: "production",
      riskScore: 74,
      confidence: 0.71,
      correlationId: "svc:production:payments",
      relatedAssetIds: ["ast_00044"],
      relatedFindingIds: ["fnd_sec-credential-exposed_ast_00044"],
      timeline: [
        { at: new Date(base - 3_600_000).toISOString(), eventType: "security.finding", summary: "Credential material found in plaintext", source: "security-engine", severity: "critical" },
        { at: new Date(base - 3_000_000).toISOString(), eventType: "infrastructure.event", summary: "CreateAccessKey from an unrecognised address", source: "aws.cloudtrail", severity: "medium" },
      ],
      suggestedActions: [
        { id: "rotate-credential", title: "Revoke and rotate the exposed key", rationale: "The credential was verified as live by the scanner.", automatable: true },
      ],
      openedAt: new Date(base - 3_600_000).toISOString(),
    },
  ];
}

export function demoFindings(): SecurityFinding[] {
  const now = new Date().toISOString();
  const rows: Array<[string, string, SecurityFinding["category"], SecurityFinding["severity"], string, number]> = [
    ["K8S-PRIVILEGED-CONTAINER", "Workload runs a privileged container", "kubernetes", "critical", "checkout-api", 94],
    ["CLOUD-STORAGE-PUBLIC", "Storage bucket is publicly readable", "cloud", "critical", "customer-exports", 92],
    ["SEC-CREDENTIAL-EXPOSED", "Credential material found in plaintext", "secrets", "critical", "payments-worker", 88],
    ["CLOUD-SG-OPEN-ADMIN", "Security group exposes an administrative port to 0.0.0.0/0", "cloud", "high", "bastion-sg", 76],
    ["IMG-UNSIGNED", "Image has no valid signature", "container", "high", "gateway:2.14.0", 68],
    ["CICD-NO-SECURITY-SCAN", "Pipeline has no security scanning stage", "cicd", "high", "identity-deploy", 61],
    ["K8S-MISSING-RESOURCE-LIMITS", "Container has no CPU or memory limit", "kubernetes", "medium", "search-indexer", 44],
  ];
  return rows.map(([ruleId, title, category, severity, assetName, riskScore], i) => ({
    id: `fnd_demo_${i}`,
    organizationId: "org_demo",
    projectId: "proj_demo",
    ruleId,
    title,
    description: "Sample finding from the bundled demo dataset.",
    category,
    severity,
    status: "open",
    assetId: `ast_${String(i + 10).padStart(5, "0")}`,
    assetName,
    environment: "production",
    internetExposed: i < 4,
    riskScore,
    remediation: "See the rule catalog in packages/security-rules for the remediation guidance.",
    references: [],
    compliance: [],
    evidence: {},
    firstSeenAt: now,
    lastSeenAt: now,
  }));
}

export function demoAssets(): Asset[] {
  return demoFindings().map((f, i) => ({
    id: f.assetId,
    organizationId: "org_demo",
    projectId: "proj_demo",
    externalId: `aws:asset:${i}`,
    name: f.assetName,
    kind: "kubernetes-workload",
    provider: "aws",
    environment: "production",
    region: "us-east-1",
    criticality: i < 3 ? "tier-0" : "tier-1",
    internetExposed: f.internetExposed,
    service: f.assetName.split("-")[0] ?? "platform",
    owner: "platform",
    tags: {},
    health: f.riskScore > 80 ? "critical" : "at-risk",
    riskScore: f.riskScore,
    discoveredAt: f.firstSeenAt,
    lastSeenAt: f.lastSeenAt,
  }));
}
