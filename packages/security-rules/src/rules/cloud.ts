import type { SecurityRule } from "../types.js";
import { cfg, isKind, isProduction } from "./helpers.js";

export const cloudRules: SecurityRule[] = [
  {
    id: "CLOUD-STORAGE-PUBLIC",
    title: "Storage bucket is publicly readable",
    description:
      "The bucket ACL or policy grants read access to anonymous principals, so any object stored in it is world-readable.",
    category: "cloud",
    severity: "critical",
    remediation: "Remove the public grant and enable the account-level public access block.",
    compliance: ["CIS-AWS-2.1.5", "NIST-800-53-AC-3"],
    references: ["https://docs.aws.amazon.com/AmazonS3/latest/userguide/access-control-block-public-access.html"],
    appliesTo: (ctx) => isKind(ctx, "cloud-storage"),
    evaluate: (ctx) => {
      const acl = cfg<string>(ctx, "acl");
      const policyPublic = cfg<boolean>(ctx, "policyAllowsAnonymous") ?? false;
      const matched = acl === "public-read" || acl === "public-read-write" || policyPublic;
      return { matched, evidence: { acl, policyPublic } };
    },
  },
  {
    id: "CLOUD-DB-PUBLIC",
    title: "Managed database reachable from the internet",
    description: "The database instance has a public endpoint and accepts connections from outside the VPC.",
    category: "cloud",
    severity: "critical",
    remediation: "Disable the public endpoint and reach the database through private networking only.",
    compliance: ["CIS-AWS-2.3.3", "PCI-DSS-1.3"],
    references: ["https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_VPC.html"],
    appliesTo: (ctx) => isKind(ctx, "database"),
    evaluate: (ctx) => ({
      matched: (cfg<boolean>(ctx, "publiclyAccessible") ?? false) === true,
      evidence: { endpoint: cfg<string>(ctx, "endpoint") },
    }),
  },
  {
    id: "CLOUD-SG-OPEN-ADMIN",
    title: "Security group exposes an administrative port to 0.0.0.0/0",
    description: "An ingress rule allows SSH or RDP from any source address.",
    category: "cloud",
    severity: "high",
    remediation: "Restrict the ingress rule to a bastion range or replace it with a session manager.",
    compliance: ["CIS-AWS-5.2"],
    references: ["https://docs.aws.amazon.com/vpc/latest/userguide/vpc-security-groups.html"],
    appliesTo: (ctx) => isKind(ctx, "security-group"),
    evaluate: (ctx) => {
      const rules = cfg<Array<{ port: number; cidr: string }>>(ctx, "ingress") ?? [];
      const admin = rules.filter((r) => [22, 3389].includes(r.port) && r.cidr === "0.0.0.0/0");
      return {
        matched: admin.length > 0,
        evidence: { openRules: admin },
        severityOverride: admin.length > 0 && isProduction(ctx) ? "critical" : undefined,
      };
    },
  },
  {
    id: "CLOUD-IAM-WILDCARD",
    title: "IAM policy grants wildcard actions",
    description: "The role can perform any action on any resource, which removes every blast-radius boundary.",
    category: "cloud",
    severity: "high",
    remediation: "Replace the wildcard statement with the specific actions the workload calls.",
    compliance: ["CIS-AWS-1.16", "NIST-800-53-AC-6"],
    references: ["https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html"],
    appliesTo: (ctx) => isKind(ctx, "iam-role"),
    evaluate: (ctx) => {
      const statements = cfg<Array<{ effect: string; action: string[]; resource: string[] }>>(ctx, "statements") ?? [];
      const offending = statements.filter(
        (s) => s.effect === "Allow" && s.action.includes("*") && s.resource.includes("*"),
      );
      return { matched: offending.length > 0, evidence: { statements: offending } };
    },
  },
  {
    id: "CLOUD-RESOURCE-UNENCRYPTED",
    title: "Data at rest is not encrypted",
    description: "The volume or bucket stores data without server-side encryption enabled.",
    category: "cloud",
    severity: "medium",
    remediation: "Enable server-side encryption with a customer-managed key and re-encrypt existing objects.",
    compliance: ["CIS-AWS-2.1.1", "PCI-DSS-3.4"],
    references: ["https://docs.aws.amazon.com/kms/latest/developerguide/services.html"],
    appliesTo: (ctx) => isKind(ctx, "cloud-storage", "database", "virtual-machine"),
    evaluate: (ctx) => ({
      matched: (cfg<boolean>(ctx, "encryptionEnabled") ?? true) === false,
      evidence: { encryptionEnabled: false },
    }),
  },
];
