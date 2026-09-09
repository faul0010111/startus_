import type { SecurityRule } from "../types.js";
import { cfg, isKind } from "./helpers.js";

interface ContainerSpec {
  name: string;
  image: string;
  privileged?: boolean;
  runAsUser?: number;
  resources?: { limits?: { cpu?: string; memory?: string } };
}

export const kubernetesRules: SecurityRule[] = [
  {
    id: "K8S-PRIVILEGED-CONTAINER",
    title: "Workload runs a privileged container",
    description: "A privileged container shares the host kernel capabilities, so a compromise escapes the pod boundary.",
    category: "kubernetes",
    severity: "critical",
    remediation: "Drop securityContext.privileged and grant only the capabilities the process needs.",
    compliance: ["CIS-K8S-5.2.1", "NSA-K8S-Hardening"],
    references: ["https://kubernetes.io/docs/concepts/security/pod-security-standards/"],
    appliesTo: (ctx) => isKind(ctx, "kubernetes-workload"),
    evaluate: (ctx) => {
      const containers = cfg<ContainerSpec[]>(ctx, "containers") ?? [];
      const privileged = containers.filter((c) => c.privileged === true).map((c) => c.name);
      return { matched: privileged.length > 0, evidence: { containers: privileged } };
    },
  },
  {
    id: "K8S-ROOT-CONTAINER",
    title: "Container runs as root",
    description: "The pod does not set runAsNonRoot, so the process starts as uid 0 inside the container.",
    category: "kubernetes",
    severity: "high",
    remediation: "Set runAsNonRoot: true and a non-zero runAsUser in the pod security context.",
    compliance: ["CIS-K8S-5.2.6"],
    references: ["https://kubernetes.io/docs/tasks/configure-pod-container/security-context/"],
    appliesTo: (ctx) => isKind(ctx, "kubernetes-workload"),
    evaluate: (ctx) => {
      const containers = cfg<ContainerSpec[]>(ctx, "containers") ?? [];
      const asRoot = containers.filter((c) => (c.runAsUser ?? 0) === 0).map((c) => c.name);
      return { matched: asRoot.length > 0, evidence: { containers: asRoot } };
    },
  },
  {
    id: "K8S-MISSING-RESOURCE-LIMITS",
    title: "Container has no CPU or memory limit",
    description: "Without limits a single workload can starve every other pod on the node.",
    category: "kubernetes",
    severity: "medium",
    remediation: "Set resources.limits for cpu and memory, or apply a LimitRange to the namespace.",
    compliance: ["CIS-K8S-5.7.3"],
    references: ["https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/"],
    appliesTo: (ctx) => isKind(ctx, "kubernetes-workload"),
    evaluate: (ctx) => {
      const containers = cfg<ContainerSpec[]>(ctx, "containers") ?? [];
      const unbounded = containers
        .filter((c) => !c.resources?.limits?.cpu || !c.resources?.limits?.memory)
        .map((c) => c.name);
      return { matched: unbounded.length > 0, evidence: { containers: unbounded } };
    },
  },
  {
    id: "K8S-INSECURE-RBAC",
    title: "Subject bound to cluster-admin",
    description: "A ServiceAccount or group holds cluster-admin, which is full control of the cluster.",
    category: "kubernetes",
    severity: "critical",
    remediation: "Replace the binding with a namespaced Role that grants only the verbs in use.",
    compliance: ["CIS-K8S-5.1.1"],
    references: ["https://kubernetes.io/docs/reference/access-authn-authz/rbac/"],
    appliesTo: (ctx) => isKind(ctx, "kubernetes-cluster", "kubernetes-workload"),
    evaluate: (ctx) => {
      const bindings = cfg<Array<{ subject: string; role: string }>>(ctx, "roleBindings") ?? [];
      const admin = bindings.filter((b) => b.role === "cluster-admin");
      return { matched: admin.length > 0, evidence: { bindings: admin } };
    },
  },
  {
    id: "K8S-HOST-NETWORK",
    title: "Pod uses the host network namespace",
    description: "hostNetwork: true removes network isolation and exposes the node's interfaces to the pod.",
    category: "kubernetes",
    severity: "high",
    remediation: "Remove hostNetwork and expose the workload through a Service instead.",
    compliance: ["CIS-K8S-5.2.4"],
    references: ["https://kubernetes.io/docs/concepts/security/pod-security-standards/"],
    appliesTo: (ctx) => isKind(ctx, "kubernetes-workload"),
    evaluate: (ctx) => ({
      matched: (cfg<boolean>(ctx, "hostNetwork") ?? false) === true,
      evidence: { hostNetwork: true },
    }),
  },
];
