import type { SecurityRule } from "./types.js";
import { cloudRules } from "./rules/cloud.js";
import { kubernetesRules } from "./rules/kubernetes.js";
import { containerRules } from "./rules/container.js";
import { secretsRules } from "./rules/secrets.js";
import { cicdRules } from "./rules/cicd.js";

export const catalog: SecurityRule[] = [
  ...cloudRules,
  ...kubernetesRules,
  ...containerRules,
  ...secretsRules,
  ...cicdRules,
];

export function ruleById(id: string): SecurityRule | undefined {
  return catalog.find((r) => r.id === id);
}

export { cloudRules, kubernetesRules, containerRules, secretsRules, cicdRules };
