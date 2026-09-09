import type { SecurityRule } from "../types.js";
import { cfg, isKind } from "./helpers.js";

export const containerRules: SecurityRule[] = [
  {
    id: "IMG-KNOWN-VULNERABILITIES",
    title: "Image ships known critical vulnerabilities",
    description: "The scanner reported fixable critical CVEs in the image layers currently deployed.",
    category: "container",
    severity: "critical",
    remediation: "Rebuild on a patched base image and redeploy; fail the pipeline on fixable criticals.",
    compliance: ["NIST-800-190-4.1"],
    references: ["https://csrc.nist.gov/publications/detail/sp/800-190/final"],
    appliesTo: (ctx) => isKind(ctx, "container-image"),
    evaluate: (ctx) => {
      const cves = cfg<Array<{ id: string; severity: string; fixedIn?: string }>>(ctx, "vulnerabilities") ?? [];
      const critical = cves.filter((c) => c.severity === "critical" && c.fixedIn);
      return { matched: critical.length > 0, evidence: { count: critical.length, cves: critical.slice(0, 10) } };
    },
  },
  {
    id: "IMG-LATEST-TAG",
    title: "Deployment references the latest tag",
    description: "A mutable tag makes the running version unknowable and breaks rollback.",
    category: "container",
    severity: "medium",
    remediation: "Pin the image to an immutable digest or a released version tag.",
    compliance: ["NIST-800-190-3.1"],
    references: ["https://kubernetes.io/docs/concepts/containers/images/"],
    appliesTo: (ctx) => isKind(ctx, "container-image", "kubernetes-workload"),
    evaluate: (ctx) => {
      const images = cfg<string[]>(ctx, "images") ?? [];
      const mutable = images.filter((i) => i.endsWith(":latest") || !i.includes(":"));
      return { matched: mutable.length > 0, evidence: { images: mutable } };
    },
  },
  {
    id: "IMG-UNSIGNED",
    title: "Image has no valid signature",
    description: "No cosign signature or attestation was found, so provenance cannot be verified.",
    category: "container",
    severity: "high",
    remediation: "Sign images in the pipeline and enforce verification with an admission policy.",
    compliance: ["SLSA-L3"],
    references: ["https://docs.sigstore.dev/cosign/overview/"],
    appliesTo: (ctx) => isKind(ctx, "container-image"),
    evaluate: (ctx) => ({
      matched: (cfg<boolean>(ctx, "signed") ?? false) === false,
      evidence: { registry: cfg<string>(ctx, "registry") },
    }),
  },
  {
    id: "IMG-PRIVILEGED-RUNTIME",
    title: "Container started with elevated runtime flags",
    description: "The runtime was given --privileged or extra capabilities such as SYS_ADMIN.",
    category: "container",
    severity: "high",
    remediation: "Remove the flag and add only the specific capability the workload requires.",
    compliance: ["NIST-800-190-4.4"],
    references: ["https://docs.docker.com/engine/reference/run/#runtime-privilege-and-linux-capabilities"],
    appliesTo: (ctx) => isKind(ctx, "container-image", "virtual-machine"),
    evaluate: (ctx) => {
      const caps = cfg<string[]>(ctx, "capabilities") ?? [];
      const risky = caps.filter((c) => ["SYS_ADMIN", "NET_ADMIN", "ALL"].includes(c));
      return { matched: risky.length > 0, evidence: { capabilities: risky } };
    },
  },
];
