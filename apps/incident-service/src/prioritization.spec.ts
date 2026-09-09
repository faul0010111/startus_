import { describe, expect, it } from "vitest";
import { prioritize, suggestActions } from "./prioritization.js";

describe("prioritize", () => {
  it("pages on a high-risk production incident", () => {
    expect(
      prioritize({ riskScore: 92, confidence: 0.9, environment: "production", internetExposed: true, affectedAssets: 2 }),
    ).toBe("P1");
  });

  it("holds back when the correlation is weak, even at a high risk score", () => {
    expect(
      prioritize({ riskScore: 92, confidence: 0.35, environment: "production", internetExposed: false, affectedAssets: 1 }),
    ).not.toBe("P1");
  });

  it("does not page for a staging incident with the same numbers", () => {
    const production = prioritize({ riskScore: 75, confidence: 0.9, environment: "production", internetExposed: true, affectedAssets: 1 });
    const staging = prioritize({ riskScore: 75, confidence: 0.9, environment: "staging", internetExposed: true, affectedAssets: 1 });
    expect(production).toBe("P1");
    expect(staging).toBe("P2");
  });

  it("escalates on breadth when the score alone would not", () => {
    expect(
      prioritize({ riskScore: 20, confidence: 0.6, environment: "development", internetExposed: false, affectedAssets: 9 }),
    ).toBe("P3");
  });
});

describe("suggestActions", () => {
  it("offers a rollback when a deployment is implicated", () => {
    const actions = suggestActions({
      hypothesis: "A recent deployment coincides with degraded service performance",
      findingIds: [],
      services: ["checkout"],
      environment: "production",
    });
    expect(actions.map((a) => a.id)).toContain("rollback-latest-deploy");
    expect(actions.at(-1)?.id).toBe("page-owner");
  });

  it("offers containment when findings are attached", () => {
    const actions = suggestActions({
      hypothesis: "Multiple related infrastructure signals on the same service",
      findingIds: ["fnd_1"],
      services: ["payments"],
      environment: "production",
    });
    expect(actions.map((a) => a.id)).toContain("contain-exposure");
  });
});
