import {
  CRITICALITY_MULTIPLIER,
  ENVIRONMENT_MULTIPLIER,
  SEVERITY_WEIGHT,
  type AssetCriticality,
  type Environment,
  type RiskAssessment,
  type RiskBand,
  type RiskFactor,
  type Severity,
} from "@stratus/shared-types";

export interface ScoringInput {
  subjectId: string;
  subjectType: RiskAssessment["subjectType"];
  severity: Severity;
  criticality: AssetCriticality;
  environment: Environment;
  internetExposed: boolean;
  /** Days since the finding was first seen. Unremediated risk compounds. */
  ageDays: number;
  /** Other open findings on the same asset. */
  relatedFindings: number;
  /** Incidents involving this asset in the last 90 days. */
  historicalIncidents: number;
}

export const EXPOSURE_BONUS = 12;
export const AGE_CAP = 10;
export const RELATED_CAP = 12;
export const HISTORY_CAP = 8;

export function bandFor(score: number): RiskBand {
  if (score >= 85) return "severe";
  if (score >= 70) return "high";
  if (score >= 50) return "elevated";
  if (score >= 30) return "moderate";
  return "low";
}

/**
 * Additive, explainable scoring. Every factor returns its own contribution so
 * the console can show why an asset is ranked where it is; a black-box score
 * nobody trusts does not get acted on.
 */
export function scoreRisk(input: ScoringInput): RiskAssessment {
  const factors: RiskFactor[] = [];

  const base = SEVERITY_WEIGHT[input.severity];
  factors.push({ name: "severity", contribution: base, detail: `${input.severity} severity` });

  const criticality = CRITICALITY_MULTIPLIER[input.criticality];
  const environment = ENVIRONMENT_MULTIPLIER[input.environment];
  const weighted = base * criticality * environment;
  factors.push({
    name: "business-context",
    contribution: round(weighted - base),
    detail: `${input.criticality} asset in ${input.environment}`,
  });

  const exposure = input.internetExposed ? EXPOSURE_BONUS : 0;
  if (exposure) factors.push({ name: "internet-exposure", contribution: exposure, detail: "Reachable from the internet" });

  // Age grows on a log curve: the first week matters far more than the tenth.
  const age = Math.min(AGE_CAP, Math.log2(Math.max(1, input.ageDays)) * 2);
  if (age > 0) factors.push({ name: "age", contribution: round(age), detail: `Open for ${Math.round(input.ageDays)}d` });

  const related = Math.min(RELATED_CAP, input.relatedFindings * 2);
  if (related > 0)
    factors.push({ name: "related-findings", contribution: related, detail: `${input.relatedFindings} findings on the same asset` });

  const history = Math.min(HISTORY_CAP, input.historicalIncidents * 3);
  if (history > 0)
    factors.push({ name: "incident-history", contribution: history, detail: `${input.historicalIncidents} incidents in 90d` });

  const total = clamp(weighted + exposure + age + related + history);

  return {
    subjectId: input.subjectId,
    subjectType: input.subjectType,
    score: round(total),
    band: bandFor(total),
    factors,
    computedAt: new Date().toISOString(),
  };
}

/**
 * Organization score is not an average: one severe production asset should move
 * the number. Findings are aggregated with a soft-max weighted by severity.
 */
export function aggregateOrganizationScore(assetScores: number[]): number {
  if (assetScores.length === 0) return 0;
  const sorted = [...assetScores].sort((a, b) => b - a);
  const worst = sorted[0] ?? 0;
  const mean = sorted.reduce((sum, s) => sum + s, 0) / sorted.length;
  return round(clamp(worst * 0.6 + mean * 0.4));
}

/** Posture score shown in the console: 100 is clean, 0 is on fire. */
export function postureScore(riskScore: number): number {
  return round(clamp(100 - riskScore));
}

const clamp = (n: number): number => Math.max(0, Math.min(100, n));
const round = (n: number): number => Math.round(n * 10) / 10;
