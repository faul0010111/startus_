import type { IncidentPriority, SuggestedAction } from "@stratus/shared-types";

export interface PriorityInput {
  riskScore: number;
  confidence: number;
  environment: string;
  internetExposed: boolean;
  affectedAssets: number;
}

/**
 * Priority is a paging decision, not a score. Production and internet exposure
 * escalate; low confidence holds an incident back so on-call is not woken by a
 * coincidence.
 */
export function prioritize(input: PriorityInput): IncidentPriority {
  const production = input.environment === "production";
  const weighted = input.riskScore * input.confidence;

  if (production && (weighted >= 70 || (input.internetExposed && weighted >= 55))) return "P1";
  if (weighted >= 55 || (production && weighted >= 40)) return "P2";
  if (weighted >= 30 || input.affectedAssets > 3) return "P3";
  return "P4";
}

export interface ActionInput {
  hypothesis: string;
  findingIds: string[];
  services: string[];
  environment: string;
}

/** Deterministic playbook lookup: no model in the loop, no invented advice. */
export function suggestActions(input: ActionInput): SuggestedAction[] {
  const actions: SuggestedAction[] = [];
  const service = input.services[0] ?? "the affected service";

  if (/deployment/i.test(input.hypothesis)) {
    actions.push({
      id: "rollback-latest-deploy",
      title: `Roll back the most recent deployment of ${service}`,
      rationale: "The incident window opens immediately after a deployment completed.",
      automatable: true,
    });
    actions.push({
      id: "freeze-pipeline",
      title: `Hold further deploys to ${input.environment} until the incident is mitigated`,
      rationale: "Prevents stacking another change on top of an unexplained regression.",
      automatable: true,
    });
  }
  if (/security|exposure/i.test(input.hypothesis) || input.findingIds.length > 0) {
    actions.push({
      id: "contain-exposure",
      title: "Remove public exposure on the affected resources",
      rationale: "Findings in this cluster describe reachable attack surface.",
      automatable: false,
    });
  }
  if (/performance|behaviour/i.test(input.hypothesis)) {
    actions.push({
      id: "scale-and-observe",
      title: `Scale ${service} and watch error budget burn for 15 minutes`,
      rationale: "Buys headroom while the root cause is confirmed.",
      automatable: true,
    });
  }
  actions.push({
    id: "page-owner",
    title: `Notify the owning team for ${service}`,
    rationale: "Every open incident needs a named owner.",
    automatable: true,
  });
  return actions;
}
