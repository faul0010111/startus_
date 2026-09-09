# Hardening checklist

Every control below is implemented in this repository, with the file that
implements it. STRATUS applies its own rule catalog to itself: each row that
maps to a rule id would produce a finding if it regressed.

## Build and supply chain

| Control | Where | Rule |
|---|---|---|
| Multi-stage builds; no toolchain in the runtime layer | `infrastructure/docker/Dockerfile.service` | — |
| Runtime runs as a dedicated non-root user | `Dockerfile.service`, `Dockerfile.console` | `CONTAINER-ROOT` |
| Base images pinned to a version, never `:latest` | both Dockerfiles (`node:22-alpine`) | `CONTAINER-LATEST` |
| Images signed with cosign on publish | `.github/workflows/docker.yml` | `CONTAINER-UNSIGNED` |
| GitHub Actions pinned; `trivy-action` pinned by commit SHA | `.github/workflows/security.yml` | — |
| Workflow token is the scoped `GITHUB_TOKEN`, least privilege per job | all workflows (`permissions:`) | `CICD-WRITE-ALL-TOKEN` |
| Dependency audit gate at HIGH in CI | `security.yml` → `pnpm audit --audit-level high` | `CICD-NO-SCANNING` |
| CodeQL with `security-extended` | `security.yml` | `CICD-NO-SCANNING` |
| Trivy IaC scan, fails the build on HIGH/CRITICAL | `security.yml` | `CICD-NO-SCANNING` |
| Lockfile committed; CI installs with `--frozen-lockfile` | `pnpm-lock.yaml`, `ci.yml` | — |

## Container runtime

| Control | Where | Rule |
|---|---|---|
| `runAsNonRoot`, fixed uid/gid 10001 | `kubernetes/base/api-deployment.yaml`, `workers.yaml` | `K8S-ROOT-CONTAINER` |
| `allowPrivilegeEscalation: false` | same | `K8S-PRIVILEGED` |
| `readOnlyRootFilesystem: true`, writable `/tmp` via emptyDir | same | — |
| All capabilities dropped | same | `CONTAINER-CAPABILITIES` |
| `seccompProfile: RuntimeDefault` | same | — |
| CPU and memory requests *and* limits on every container | same | `K8S-NO-LIMITS` |
| Pod Security `restricted` enforced at the namespace | `kubernetes/base/namespace.yaml` | — |
| No `hostNetwork`, no `hostPath` | all manifests | `K8S-HOST-NETWORK` |

## Identity and access

| Control | Where | Rule |
|---|---|---|
| Dedicated `stratus` ServiceAccount, no cluster-admin | `kubernetes/base/rbac.yaml` | `K8S-CLUSTER-ADMIN` |
| Collector ClusterRole is read-only (`get`/`list`/`watch`) over inventory | `rbac.yaml` | `CLOUD-IAM-WILDCARD` |
| `automountServiceAccountToken: false` | `rbac.yaml` | — |
| No wildcard IAM in the Terraform module | `terraform/modules/stratus-platform/main.tf` | `CLOUD-IAM-WILDCARD` |

## Network

| Control | Where | Rule |
|---|---|---|
| Default-deny NetworkPolicy for ingress and egress | `kubernetes/base/networkpolicy.yaml` | — |
| Explicit allow list: in-namespace, ingress namespace, observability, DNS | same | — |
| All data services in private subnets | `terraform/.../main.tf` | `CLOUD-DB-PUBLIC` |
| RDS `publicly_accessible = false` | same | `CLOUD-DB-PUBLIC` |
| No `0.0.0.0/0` administrative ingress | same | `CLOUD-OPEN-ADMIN` |
| No public load balancer in the module | same | `CLOUD-PUBLIC-BUCKET` |

## Data

| Control | Where | Rule |
|---|---|---|
| Customer-managed KMS key for the platform | `terraform/.../main.tf` | `CLOUD-UNENCRYPTED` |
| MSK encryption at rest and in transit | same | `CLOUD-UNENCRYPTED` |
| RDS `storage_encrypted = true` with the KMS key | same | `CLOUD-UNENCRYPTED` |
| ElastiCache encrypted with the KMS key | same | `CLOUD-UNENCRYPTED` |
| Database credentials from a Kubernetes secret, never a ConfigMap | `api-deployment.yaml` | `SECRET-ENV-VAR` |
| No credentials in the repository | — | `SECRET-PLAINTEXT` |

## Application

| Control | Where |
|---|---|
| Environment validated at boot; a service with a bad env never reports ready | `packages/config/src/index.ts` |
| Event envelopes validated on produce and on consume | `packages/event-contracts/src/serialization.ts` |
| Contract violations dead-lettered, not dropped or retried forever | `packages/event-contracts/src/bus.ts` |
| A throwing rule is isolated and cannot halt evaluation | `packages/security-rules/src/engine.ts` |
| Rule evaluation is deterministic and side-effect free | `packages/security-rules/` |
| Risk factors individually capped; no single input dominates | `apps/risk-engine/src/scoring.ts`, ADR-0003 |
| Manual commit only after successful handling (at-least-once) | `bus.ts` |
| No write path into observed infrastructure; suggested actions are advisory | by design |

## Observability

| Control | Where |
|---|---|
| `/healthz`, `/readyz`, `/metrics` on every service | `apps/*/src/health.controller.ts` |
| Traces exported over OTLP, trace id attached to every log line | `packages/observability/` |
| Payload bodies never logged | `packages/observability/src/logger.ts` |
| Alerting on pipeline silence, consumer lag and DLQ spikes | `observability/prometheus/alerts.yml` |

## Verifying the posture

```bash
pnpm audit --audit-level high
trivy config infrastructure --severity HIGH,CRITICAL --exit-code 1
```

Both run on every push and pull request. The IaC scan currently reports zero
HIGH/CRITICAL findings; there are MEDIUM/LOW findings in `workers.yaml`,
`api-deployment.yaml`, the Terraform module and `Dockerfile.console` that are
below the gate and tracked in [known-gaps.md](./known-gaps.md).
