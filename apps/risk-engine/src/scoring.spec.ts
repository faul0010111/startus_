import { describe, expect, it } from "vitest";
import { aggregateOrganizationScore, bandFor, postureScore, scoreRisk, type ScoringInput } from "./scoring.js";

const base: ScoringInput = {
  subjectId: "fnd_1",
  subjectType: "finding",
  severity: "medium",
  criticality: "tier-2",
  environment: "staging",
  internetExposed: false,
  ageDays: 1,
  relatedFindings: 0,
  historicalIncidents: 0,
};

describe("scoreRisk", () => {
  it("ranks the same finding higher in production than in development", () => {
    const prod = scoreRisk({ ...base, environment: "production" });
    const dev = scoreRisk({ ...base, environment: "development" });
    expect(prod.score).toBeGreaterThan(dev.score);
  });

  it("adds a fixed premium for internet exposure", () => {
    const exposed = scoreRisk({ ...base, internetExposed: true });
    const isolated = scoreRisk(base);
    expect(exposed.score - isolated.score).toBeCloseTo(12, 1);
  });

  it("never leaves the 0-100 range, even when every factor is maxed", () => {
    const worst = scoreRisk({
      ...base,
      severity: "critical",
      criticality: "tier-0",
      environment: "production",
      internetExposed: true,
      ageDays: 900,
      relatedFindings: 50,
      historicalIncidents: 20,
    });
    expect(worst.score).toBeLessThanOrEqual(100);
    expect(worst.score).toBeGreaterThan(85);
    expect(worst.band).toBe("severe");
  });

  it("explains every point it adds", () => {
    const assessment = scoreRisk({ ...base, internetExposed: true, relatedFindings: 3, historicalIncidents: 1 });
    const named = assessment.factors.map((f) => f.name);
    expect(named).toContain("severity");
    expect(named).toContain("internet-exposure");
    expect(named).toContain("related-findings");
    expect(named).toContain("incident-history");
  });

  it("grows sublinearly with age so a stale low finding cannot outrank a fresh critical one", () => {
    const week = scoreRisk({ ...base, ageDays: 7 });
    const year = scoreRisk({ ...base, ageDays: 365 });
    expect(year.score - week.score).toBeLessThan(6);
  });
});

describe("bandFor", () => {
  it.each([
    [95, "severe"],
    [72, "high"],
    [55, "elevated"],
    [31, "moderate"],
    [10, "low"],
  ])("maps %i to %s", (score, band) => {
    expect(bandFor(score)).toBe(band);
  });
});

describe("aggregateOrganizationScore", () => {
  it("is dominated by the worst asset rather than diluted by healthy ones", () => {
    const withOutlier = aggregateOrganizationScore([95, 5, 5, 5, 5]);
    const flat = aggregateOrganizationScore([25, 25, 25, 25, 25]);
    expect(withOutlier).toBeGreaterThan(flat);
  });

  it("returns zero for an empty estate", () => {
    expect(aggregateOrganizationScore([])).toBe(0);
  });
});

describe("postureScore", () => {
  it("inverts risk into the number shown in the console", () => {
    expect(postureScore(22)).toBe(78);
  });
});
