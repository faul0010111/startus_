import type { SecurityRule } from "../types.js";
import { cfg } from "./helpers.js";

const SECRET_KEY_PATTERN = /(secret|token|password|passwd|api[_-]?key|private[_-]?key|credential)/i;

export const secretsRules: SecurityRule[] = [
  {
    id: "SEC-CREDENTIAL-EXPOSED",
    title: "Credential material found in plaintext",
    description: "A scanned artifact contains what looks like a live credential rather than a reference to a vault.",
    category: "secrets",
    severity: "critical",
    remediation: "Revoke and rotate the credential, then load it from the secret manager at runtime.",
    compliance: ["OWASP-ASVS-2.10", "CIS-AWS-1.4"],
    references: ["https://owasp.org/www-project-application-security-verification-standard/"],
    appliesTo: () => true,
    evaluate: (ctx) => {
      const matches = cfg<Array<{ path: string; detector: string; verified: boolean }>>(ctx, "secretMatches") ?? [];
      const verified = matches.filter((m) => m.verified);
      return {
        matched: matches.length > 0,
        evidence: { total: matches.length, verified: verified.length, sample: matches.slice(0, 5) },
        severityOverride: verified.length === 0 ? "high" : undefined,
      };
    },
  },
  {
    id: "SEC-ENV-VAR-SECRET",
    title: "Secret passed through an environment variable",
    description: "Environment variables are readable from the process table and leak into crash dumps and logs.",
    category: "secrets",
    severity: "high",
    remediation: "Mount the value from a secret store as a file, or inject it through a CSI secrets driver.",
    compliance: ["NIST-800-190-3.4"],
    references: ["https://kubernetes.io/docs/concepts/configuration/secret/"],
    appliesTo: () => true,
    evaluate: (ctx) => {
      const env = cfg<Record<string, string>>(ctx, "environmentVariables") ?? {};
      const suspicious = Object.keys(env).filter(
        (key) => SECRET_KEY_PATTERN.test(key) && !String(env[key] ?? "").startsWith("vault:"),
      );
      return { matched: suspicious.length > 0, evidence: { variables: suspicious } };
    },
  },
  {
    id: "SEC-SECRET-EXPIRED",
    title: "Secret is past its rotation deadline",
    description: "The stored secret has not been rotated within the configured lifetime.",
    category: "secrets",
    severity: "medium",
    remediation: "Rotate the secret and enable automatic rotation in the secret manager.",
    compliance: ["NIST-800-53-IA-5"],
    references: ["https://csrc.nist.gov/publications/detail/sp/800-53/rev-5/final"],
    appliesTo: () => true,
    evaluate: (ctx) => {
      const rotatedAt = cfg<string>(ctx, "secretRotatedAt");
      const maxAgeDays = cfg<number>(ctx, "secretMaxAgeDays") ?? 90;
      if (!rotatedAt) return { matched: false };
      const ageDays = (Date.now() - Date.parse(rotatedAt)) / 86_400_000;
      return {
        matched: ageDays > maxAgeDays,
        evidence: { ageDays: Math.round(ageDays), maxAgeDays },
        severityOverride: ageDays > maxAgeDays * 2 ? "high" : undefined,
      };
    },
  },
];
