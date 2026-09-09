# Architecture

STRATUS is a pipeline, not a request/response application. Every capability is a
consumer of the event bus, which is what lets detection, scoring and incident
creation evolve independently.

## The six stages

| Stage | Owner | Input | Output |
| --- | --- | --- | --- |
| Collect | `signal-engine` | Provider webhooks (CloudTrail, Kubernetes, GitHub Actions, Alertmanager) | `stratus.signal.received` |
| Process | `event-processor` | Signals | `stratus.correlation.detected` |
| Analyze | `security-engine` | Signals + asset context | `stratus.security.finding.detected` |
| Score | `risk-engine` | Findings + correlations | `stratus.risk.score.updated` |
| Prioritize | `incident-service` | Correlations | `stratus.incident.created` / `.updated` |
| Present | `stratus-api` + `stratus-console` | All of the above | REST, SSE, the operator console |

## Why an event bus

Three properties matter more than throughput here:

1. **Replay.** Rules change constantly. Because signals are retained for seven
   days and rule evaluation is deterministic, a new rule can be tested against
   real traffic without instrumenting anything new.
2. **Isolation.** A slow correlation window cannot stall ingestion, and a broken
   rule cannot block incident creation. Each stage owns its own consumer group.
3. **Auditability.** Every finding traces back to the envelope that produced it
   through `correlationId`, which is what makes the incident timeline honest.

## Normalization boundary

Collectors are the only components that know a provider's payload shape. They
emit `NormalizedSignal`, and everything downstream is provider-agnostic. Adding
Azure Activity Log means writing one normalizer, not touching six services.

## State

| Store | Holds | Why there |
| --- | --- | --- |
| Kafka | Signals, findings, correlations, score updates | The system of record for what happened |
| Redis | Asset context, per-asset risk roll-up, leaderboard | Sub-millisecond lookups on the hot path |
| PostgreSQL | Incidents, the read model, risk snapshots | Query patterns the stream cannot serve, and durability across replays |

Redis is a cache, deliberately: losing it degrades scoring accuracy for a few
minutes, it does not lose data.

## Delivery semantics

At-least-once, with idempotent effects. Finding ids are derived from
`(ruleId, assetId)` and incidents are keyed by correlation key, so reprocessing
the same partition updates rows instead of duplicating them. Messages that fail
schema validation go to `<topic>.dlq` rather than blocking the partition.

## Scaling

Partition keys are resource ids, so all events about one resource land on one
partition and ordering is preserved where it matters. Workers scale
horizontally within a consumer group; the HPA scales on consumer lag as well as
CPU, because backlog is what operators actually feel.
