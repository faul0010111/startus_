# Threat model

STRATUS ingests security telemetry from an entire cloud estate and turns it into
a ranked incident list. That makes it a high-value target twice over: it holds a
map of where an organization is weakest, and it is the thing responders trust
when deciding what to look at first. An attacker who can suppress a STRATUS
finding is more dangerous than one who can read it.

This document covers what the platform defends against, what it does not, and
where the current implementation falls short. The corresponding controls are in
[hardening.md](./hardening.md); the gaps are tracked in
[known-gaps.md](./known-gaps.md).

## Scope

In scope: the six services, the Kafka bus, the read model in Postgres, the Redis
state stores, the operator console, and the deployment manifests under
`infrastructure/`.

Out of scope: the cloud provider control planes STRATUS observes, the collectors
that run inside customer infrastructure, and the CI systems that emit
`github-actions` signals. Those are signal *sources* — STRATUS treats everything
they send as untrusted input.

## Trust boundaries

| # | Boundary | Crossing |
|---|---|---|
| B1 | Internet → `signal-engine` | Collector webhooks at `/v1/signals/:source` |
| B2 | Browser → `stratus-api` | Read model queries and the SSE stream |
| B3 | Service → Kafka | Every inter-service message |
| B4 | Service → Postgres / Redis | Incident persistence and correlation state |
| B5 | CI → registry → cluster | Image build, signing, and admission |

Everything inside B3/B4 is a single trust domain today. There is no
service-to-service authentication on the bus — see known-gaps.

## Assets

- **Findings and incidents.** A live inventory of exploitable weaknesses. The
  highest-confidentiality asset in the system.
- **Asset catalog.** Names, environments, ownership and criticality of real
  infrastructure. Useful for reconnaissance on its own.
- **Risk scores.** Integrity matters more than confidentiality: a score that can
  be pushed down is a way to hide.
- **The signal stream itself.** Availability matters — a quiet pipeline looks
  identical to a healthy estate.

## Threats

Grouped by STRIDE, with the control that addresses each.

### Spoofing

- **T1 — Forged signals at B1.** Anyone who can reach `signal-engine` can inject
  normalized signals and manufacture or drown out findings. *Partially
  mitigated:* envelope schema validation rejects malformed payloads and
  dead-letters them, but there is no collector authentication yet. This is the
  single largest open gap.
- **T2 — Impersonating a service on the bus.** A workload that reaches Kafka can
  publish to any topic, including `incidents.*`. *Mitigated at the network
  layer only* — default-deny NetworkPolicy plus MSK in private subnets. No mTLS
  or SASL between services.

### Tampering

- **T3 — Suppressing a finding by publishing a competing event.** Contracts are
  validated on both produce and consume, and rule evaluation is deterministic
  and side-effect free, so a replay produces the same verdict. There is no
  cryptographic provenance on the envelope, however.
- **T4 — Poisoning the risk score.** Every factor is capped and age grows
  logarithmically, so no single input can dominate the result (ADR-0003). An
  attacker cannot drive a P1 to a P4 through one manipulated dimension.
- **T5 — Supply-chain tampering.** Images are signed with cosign and every base
  image and GitHub Action is pinned. The `aquasecurity/trivy-action` compromise
  of March 2026 is the reason actions are pinned by commit SHA rather than tag.

### Repudiation

- **T6 — No audit trail for operator actions.** Suggested actions are advisory
  and nothing writes back to infrastructure, which bounds the impact, but there
  is no record of who acknowledged or dismissed an incident. Open gap.

### Information disclosure

- **T7 — Unauthenticated read of the API or console.** Both are open today.
  `organizationId` flows through every envelope and query, but nothing enforces
  it. Mitigated operationally only: no public endpoints in the Terraform module,
  everything behind the cluster ingress.
- **T8 — Secrets in signals.** The `secrets` rule category detects plaintext
  credentials in observed infrastructure, which means secret *material can reach
  the bus inside a finding*. Findings carry the location and rule id, not the
  captured value.
- **T9 — Leakage through logs and traces.** Logs are structured and carry the
  active trace id; payload bodies are not logged.

### Denial of service

- **T10 — Ingestion flood at B1.** No rate limiting on collector webhooks. Open
  gap. Consumer lag alerting (`StratusConsumerLagGrowing`) makes it visible, and
  the HPA scales on lag as well as CPU, but that is absorption, not prevention.
- **T11 — Poison-pill message stalling a consumer.** Handlers dead-letter on
  contract violation and a throwing rule is isolated by the engine, so one bad
  message cannot halt a partition.
- **T12 — Silent pipeline.** `StratusIngestionStalled` fires after 15 minutes
  with no signals. This is the failure mode the alerting is built around.

### Elevation of privilege

- **T13 — Container escape.** Non-root, read-only root filesystem, all
  capabilities dropped, `RuntimeDefault` seccomp, restricted Pod Security
  enforced at the namespace.
- **T14 — Abusing the collector's cluster access.** The `stratus-collector`
  ClusterRole is read-only over inventory resources and
  `automountServiceAccountToken` is false on the service account, so the token
  is only present where it is explicitly mounted.

## Attacker profiles

- **Opportunistic external scanner.** Blocked by network posture; there are no
  public endpoints in the module.
- **Insider with console access.** Currently unconstrained — see T7. This is the
  profile the missing authentication work is aimed at.
- **Compromised workload inside the estate.** Can reach `signal-engine` and forge
  signals (T1). Bounded by the fact that STRATUS never writes back to
  infrastructure.
- **Supply-chain attacker.** Addressed by signing, pinning and dependency
  auditing in CI.

## Design decisions that shape the model

STRATUS is deliberately **read-only with respect to the infrastructure it
observes**. It has no remediation credentials and no write path into any cloud
account. Suggested actions are text. This caps the blast radius of a full
platform compromise at disclosure and denial of service — it cannot be turned
into a lateral movement tool.
