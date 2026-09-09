import { describe, expect, it } from "vitest";
import { RuleEngine, findingIdFor } from "./engine.js";
import { catalog } from "./catalog.js";
import type { RuleContext } from "./types.js";

const context = (over: Partial<RuleContext> = {}): RuleContext => ({
  signal: {
    signalId: "sig_1",
    type: "infrastructure-event",
    source: "test",
    organizationId: "org_demo",
    projectId: "proj_demo",
    environment: "production",
    resourceId: "res_1",
    service: "checkout",
    severity: "info",
    title: "test signal",
    observedAt: new Date().toISOString(),
    receivedAt: new Date().toISOString(),
    attributes: {},
  },
  asset: {
    id: "ast_1",
    name: "checkout",
    kind: "cloud-storage",
    internetExposed: true,
    criticality: "tier-1",
    environment: "production",
    tags: {},
  },
  configuration: {},
  ...over,
});

describe("RuleEngine", () => {
  it("flags a publicly readable bucket", () => {
    const engine = new RuleEngine(catalog);
    const results = engine.evaluate(context({ configuration: { acl: "public-read" } }));
    expect(results.map((r) => r.rule.id)).toContain("CLOUD-STORAGE-PUBLIC");
  });

  it("stays quiet on a private bucket", () => {
    const engine = new RuleEngine(catalog);
    const results = engine.evaluate(context({ configuration: { acl: "private", encryptionEnabled: true } }));
    expect(results).toHaveLength(0);
  });

  it("escalates an open admin port in production to critical", () => {
    const engine = new RuleEngine(catalog);
    const [result] = engine.evaluate(
      context({
        asset: { ...context().asset, kind: "security-group" },
        configuration: { ingress: [{ port: 22, cidr: "0.0.0.0/0" }] },
      }),
    );
    expect(result?.rule.id).toBe("CLOUD-SG-OPEN-ADMIN");
    expect(result?.severity).toBe("critical");
  });

  it("detects privileged and root containers on a workload", () => {
    const engine = new RuleEngine(catalog);
    const results = engine.evaluate(
      context({
        asset: { ...context().asset, kind: "kubernetes-workload" },
        configuration: { containers: [{ name: "api", image: "api:latest", privileged: true, runAsUser: 0 }] },
      }),
    );
    const ids = results.map((r) => r.rule.id);
    expect(ids).toContain("K8S-PRIVILEGED-CONTAINER");
    expect(ids).toContain("K8S-ROOT-CONTAINER");
    expect(ids).toContain("K8S-MISSING-RESOURCE-LIMITS");
  });

  it("respects disabled rules", () => {
    const engine = new RuleEngine(catalog, { disabledRuleIds: ["CLOUD-STORAGE-PUBLIC"] });
    const results = engine.evaluate(context({ configuration: { acl: "public-read" } }));
    expect(results.map((r) => r.rule.id)).not.toContain("CLOUD-STORAGE-PUBLIC");
  });

  it("isolates a throwing rule instead of losing the batch", () => {
    const errors: string[] = [];
    const engine = new RuleEngine(
      [
        {
          ...catalog[0]!,
          id: "BROKEN",
          appliesTo: () => true,
          evaluate: () => {
            throw new Error("boom");
          },
        },
        catalog.find((r) => r.id === "CLOUD-STORAGE-PUBLIC")!,
      ],
      { onError: (rule) => errors.push(rule.id) },
    );
    const results = engine.evaluate(context({ configuration: { acl: "public-read" } }));
    expect(errors).toEqual(["BROKEN"]);
    expect(results).toHaveLength(1);
  });

  it("produces a stable finding id for the same rule and asset", () => {
    expect(findingIdFor("CLOUD-STORAGE-PUBLIC", "ast_1")).toBe(findingIdFor("CLOUD-STORAGE-PUBLIC", "ast_1"));
  });

  it("keeps every catalog rule unique and documented", () => {
    const ids = catalog.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const rule of catalog) {
      expect(rule.remediation.length).toBeGreaterThan(10);
      expect(rule.title.length).toBeGreaterThan(5);
    }
  });
});
