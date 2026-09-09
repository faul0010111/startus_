import type { SecurityRule } from "../types.js";
import { cfg, isKind } from "./helpers.js";

export const cicdRules: SecurityRule[] = [
  {
    id: "CICD-NO-SECURITY-SCAN",
    title: "Pipeline has no security scanning stage",
    description: "The pipeline deploys without dependency, image or IaC scanning, so defects reach production unchecked.",
    category: "cicd",
    severity: "high",
    remediation: "Add SAST, dependency and image scanning stages and fail the build on critical results.",
    compliance: ["SLSA-L2", "OWASP-SCVS-1.4"],
    references: ["https://slsa.dev/spec/v1.0/levels"],
    appliesTo: (ctx) => isKind(ctx, "ci-pipeline"),
    evaluate: (ctx) => {
      const stages = cfg<string[]>(ctx, "stages") ?? [];
      const hasScan = stages.some((s) => /scan|sast|sca|trivy|semgrep|snyk/i.test(s));
      return { matched: !hasScan, evidence: { stages } };
    },
  },
  {
    id: "CICD-EXCESSIVE-PERMISSIONS",
    title: "Pipeline token has write access to everything",
    description: "The workflow requests write-all permissions, so a compromised action can push code or publish packages.",
    category: "cicd",
    severity: "high",
    remediation: "Declare least-privilege permissions per job and use short-lived OIDC credentials.",
    compliance: ["SLSA-L3", "CIS-Supply-Chain-3.1"],
    references: ["https://docs.github.com/actions/security-guides/automatic-token-authentication"],
    appliesTo: (ctx) => isKind(ctx, "ci-pipeline"),
    evaluate: (ctx) => {
      const permissions = cfg<Record<string, string>>(ctx, "permissions") ?? {};
      const writeAll = permissions["contents"] === "write" && Object.keys(permissions).length === 1;
      return { matched: writeAll || permissions["all"] === "write", evidence: { permissions } };
    },
  },
  {
    id: "CICD-EXPOSED-SECRETS",
    title: "Pipeline logs printed secret values",
    description: "A build step echoed a masked variable, leaving the value recoverable from the job log.",
    category: "cicd",
    severity: "critical",
    remediation: "Remove the debug step, rotate the exposed value and enable log masking checks.",
    compliance: ["OWASP-SCVS-2.3"],
    references: ["https://docs.github.com/actions/security-guides/encrypted-secrets"],
    appliesTo: (ctx) => isKind(ctx, "ci-pipeline"),
    evaluate: (ctx) => {
      const leaks = cfg<Array<{ job: string; variable: string }>>(ctx, "logLeaks") ?? [];
      return { matched: leaks.length > 0, evidence: { leaks } };
    },
  },
  {
    id: "CICD-UNPROTECTED-DEPLOY",
    title: "Production deploy has no approval gate",
    description: "The production environment accepts deployments without review or protection rules.",
    category: "cicd",
    severity: "medium",
    remediation: "Require an environment approval and restrict which branches can deploy to production.",
    compliance: ["SLSA-L2"],
    references: ["https://docs.github.com/actions/deployment/targeting-different-environments"],
    appliesTo: (ctx) => isKind(ctx, "ci-pipeline"),
    evaluate: (ctx) => {
      const env = cfg<{ name: string; protected: boolean }>(ctx, "deployEnvironment");
      if (!env) return { matched: false };
      return { matched: env.name === "production" && !env.protected, evidence: { environment: env } };
    },
  },
];
