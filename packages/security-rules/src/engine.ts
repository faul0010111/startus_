import type { RuleContext, RuleEvaluation, SecurityRule } from "./types.js";

export interface EngineOptions {
  /** Rule ids the tenant has switched off. */
  disabledRuleIds?: string[];
  /** Rules that failed are reported here instead of aborting the batch. */
  onError?: (rule: SecurityRule, error: unknown) => void;
}

/**
 * Deterministic, side-effect free evaluation. The same context always produces
 * the same findings, which is what makes replay from Kafka safe.
 */
export class RuleEngine {
  private readonly rules: SecurityRule[];

  constructor(rules: SecurityRule[], private readonly options: EngineOptions = {}) {
    const disabled = new Set(options.disabledRuleIds ?? []);
    this.rules = rules.filter((r) => !disabled.has(r.id));
  }

  get size(): number {
    return this.rules.length;
  }

  evaluate(ctx: RuleContext): RuleEvaluation[] {
    const results: RuleEvaluation[] = [];
    for (const rule of this.rules) {
      try {
        if (!rule.appliesTo(ctx)) continue;
        const match = rule.evaluate(ctx);
        if (!match.matched) continue;
        results.push({
          rule,
          severity: match.severityOverride ?? rule.severity,
          evidence: match.evidence ?? {},
        });
      } catch (error) {
        this.options.onError?.(rule, error);
      }
    }
    return results;
  }
}

/** Stable finding id so re-evaluating the same fact updates instead of duplicating. */
export function findingIdFor(ruleId: string, assetId: string): string {
  return `fnd_${ruleId.toLowerCase().replace(/[^a-z0-9]+/g, "-")}_${assetId}`;
}
