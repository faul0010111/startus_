import type { FindingCategory, NormalizedSignal, Severity } from "@stratus/shared-types";

/** Facts a rule is evaluated against: the signal plus what we know about the asset. */
export interface RuleContext {
  signal: NormalizedSignal;
  asset: {
    id: string;
    name: string;
    kind: string;
    internetExposed: boolean;
    criticality: string;
    environment: string;
    tags: Record<string, string>;
  };
  /** Arbitrary configuration snapshot captured by the collector. */
  configuration: Record<string, unknown>;
}

export interface RuleMatch {
  matched: boolean;
  evidence?: Record<string, unknown>;
  /** Lets a rule raise severity for a specific instance, e.g. public + prod. */
  severityOverride?: Severity;
}

export interface SecurityRule {
  id: string;
  title: string;
  description: string;
  category: FindingCategory;
  severity: Severity;
  remediation: string;
  compliance: string[];
  references: string[];
  /** Cheap pre-filter so the engine skips rules that cannot apply. */
  appliesTo: (ctx: RuleContext) => boolean;
  evaluate: (ctx: RuleContext) => RuleMatch;
}

export interface RuleEvaluation {
  rule: SecurityRule;
  severity: Severity;
  evidence: Record<string, unknown>;
}
