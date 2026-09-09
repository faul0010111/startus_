# STRATUS

**Event-driven cloud security and infrastructure intelligence.**

STRATUS ingests infrastructure signals from across a cloud estate, evaluates
them against a rule catalog, correlates what belongs together, and opens a
single prioritized incident instead of forty disconnected alerts.

TypeScript monorepo: six services on a Kafka bus, a Next.js operator console,
and the infrastructure to run all of it.

---

## The problem this solves

A deployment lands. Latency degrades. A misconfiguration appears. Three tools
fire three alerts and a human spends the first twenty minutes of an incident
establishing that they are the same event.

The correlation is the product. Everything below exists to turn a stream of
independent observations into one ranked, explained, attributable incident.

```
collectors -> normalize -> evaluate -> correlate -> score -> prioritize -> console
```

---

## Architecture

### Topology

Every service is a Kafka consumer, a Kafka producer, or both. No service calls
another over HTTP. The only synchronous surfaces in the system are the collector
webhooks at the edge and the read API in front of the console.

| Service | Consumes | Produces | Port |
|---|---|---|---|
| `signal-engine` | HTTP webhooks | `signal.received` | 4010 |
| `security-engine` | `signal.received` | `security.finding.detected` | 4030 |
| `event-processor` | `signal.received`, `security.finding.detected` | `correlation.detected` | 4020 |
| `risk-engine` | `security.finding.detected`, `correlation.detected` | `risk.score.updated` | 4040 |
| `incident-service` | `correlation.detected` | `incident.created`, `incident.updated` | 4050 |
| `stratus-api` | `finding.detected`, `incident.created`, `risk.score.updated` | — | 4000 |
| `stratus-console` | HTTP + SSE | — | 3000 |

`stratus-api` is deliberately a pure consumer. The read path never writes to the
bus, so a hot dashboard cannot perturb the pipeline.

`security-engine` and `event-processor` both consume `signal.received`
independently, in separate consumer groups. Rule evaluation and correlation are
orthogonal concerns and neither should block the other.

### The envelope

Every message on the bus carries the same wrapper, so a consumer can route,
deduplicate and correlate without parsing the payload:

```ts
interface StratusEvent<T> {
  eventId: string;         // uuid, deduplication key
  eventType: string;
  timestamp: string;       // ISO 8601
  source: string;
  organizationId: string;  // tenant, present on every message
  projectId: string;
  environment: "production" | "staging" | "development" | "sandbox";
  correlationId: string;   // propagated by collectors; a commit sha, a trace id
  version: string;         // "MAJOR.MINOR", currently "1.0"
  payload: T;
}
```

`organizationId` and `projectId` live on the envelope rather than the payload
because tenancy is a routing concern, not a domain concern. Every downstream
query is already scoped by them — see [known gaps](docs/security/known-gaps.md)
for why nothing *enforces* that scope yet.

Three Kafka headers mirror envelope fields so a consumer can filter without
deserializing: `x-correlation-id`, `x-event-type`, `x-contract-version`.

### Topics

| Topic | Partitions | Retention | Compacted |
|---|---|---|---|
| `stratus.asset.discovered` | 6 | 30d | yes |
| `stratus.signal.received` | 12 | 7d | no |
| `stratus.correlation.detected` | 6 | 14d | no |
| `stratus.security.finding.detected` | 6 | 30d | no |
| `stratus.security.finding.updated` | 6 | 30d | no |
| `stratus.deployment.completed` | 3 | 30d | no |
| `stratus.performance.alert` | 6 | 7d | no |
| `stratus.risk.score.updated` | 6 | 90d | yes |
| `stratus.incident.created` | 3 | 90d | no |
| `stratus.incident.updated` | 3 | 90d | no |
| `stratus.system.alert` | 3 | 7d | no |

The partition counts are the ingestion shape: `signal.received` carries an order
of magnitude more traffic than anything downstream, so it gets 12 partitions
while the incident topics get 3.

Compaction is applied where a topic represents *current state* rather than
*history*. An asset's latest discovery record and its latest risk score are
worth keeping forever at one row per key; the signal that produced them is not.

The partition key is always the resource id. Every event about one resource
lands on one partition, which is what makes per-resource ordering hold without
a global ordering guarantee.

`correlation.detected` is internal — emitted and consumed only inside the
platform. ADR-0005 covers why it is a topic rather than an in-process call.

### Delivery semantics

At-least-once, with the failure modes handled explicitly:

- **Producers are idempotent** (`idempotent: true`), so a retried send does not
  duplicate within a session.
- **Auto topic creation is off** on producer and consumer. A typo in a topic
  name fails loudly instead of silently creating a topic nobody reads.
- **Payloads are validated on consume, not trusted on produce.** `decode()`
  parses against the Zod schema for that topic and throws
  `ContractViolationError` on a mismatch.
- **Anything that throws is dead-lettered** to `<topic>.dlq` with three headers:
  `x-error`, `x-error-kind` (`contract` vs `handler`) and `x-failed-at`. One
  malformed producer cannot stall a partition.
- **Consumers are keyed by group**, one per service, except the API's SSE
  consumer which uses `stratus-api-sse-${pid}` so every replica sees every event
  rather than sharing partitions.

Handlers must be idempotent. Findings carry a deterministic id —
`findingIdFor(ruleId, assetId)` — so re-evaluating the same fact updates the row
instead of creating a second one.

---

## Correlation

The interesting part. `CorrelationEngine` is a sliding window over the shared
dimensions of a signal.

**Bucketing.** An explicit `correlationId` wins when present — a commit sha
propagated by the collectors ties a deploy to the alerts it caused. Otherwise
signals bucket by `environment:service`.

**Signal families.** Every event type maps to one of `deployment`,
`performance`, `security`, `infrastructure`. A cluster is emitted only when the
bucket holds **at least two signals spanning at least two families**. Three
copies of the same latency alert are not a story; a deploy plus a latency alert
plus a new critical finding is.

**Confidence** is additive and bounded at 1.0:

```
0.20  base
    + min(0.6, (families - 1) x 0.3)     distinct signal families
    + 0.25 / 0.15 / 0.05                 critical / high / lower severity present
    + 0.20 | 0.10 | 0                    spread <=5min | <=half-window | wider
```

Default window is 15 minutes, default publish threshold is 0.5. Both are
constructor options, and `now()` is injectable so the tests are deterministic
rather than sleep-based.

**Eviction** is lazy, on ingest: events older than `now - windowMs` are dropped
and empty buckets removed. There is no background timer to leak.

The hypothesis string is a lookup over the family set, not generated text. A
deployment + performance + security cluster always produces the same sentence.
Nothing in the incident path invents prose.

---

## Risk scoring

Additive, bounded, and fully attributable. Every factor returns its own
contribution and the console renders the breakdown next to the number — a score
nobody can interrogate is a score nobody acts on.

```
base     = SEVERITY_WEIGHT[severity]        critical 40 | high 28 | medium 16 | low 8 | info 2
weighted = base x CRITICALITY x ENVIRONMENT tier-0 1.5 .. tier-3 0.8 | prod 1.4 .. sandbox 0.5

score = clamp(weighted
            + 12                                    if internet-exposed
            + min(10, log2(max(1, ageDays)) x 2)
            + min(12, relatedFindings x 2)
            + min(8,  historicalIncidents x 3), 0, 100)
```

Two properties are deliberate, and both are asserted by tests:

- **Every secondary factor is capped** — exposure, age, related findings and
  incident history contribute at most 12, 10, 12 and 8. No single dimension can
  dominate, so a finding cannot be pushed to the top of the queue by inflating
  one input.
- **Age grows logarithmically.** The first week of an unremediated finding moves
  the score far more than the tenth. Linear age decay makes everything old look
  urgent, which is the same as nothing looking urgent.

Bands: `severe >=85 | high >=70 | elevated >=50 | moderate >=30 | low`.

The organization score is not a mean — an average hides one burning production
asset behind fifty healthy sandboxes. It is a soft-max: `worst x 0.6 + mean x
0.4`. The posture score shown in the console is `100 - risk`.

The per-asset roll-up (open findings, incident history) lives in Redis under
`stratus:risk:asset:<id>`, which keeps scoring a streaming operation instead of
a Postgres query on every event.

What this model gives up is written down in ADR-0003.

---

## Rule engine

21 rules across five categories, each carrying severity, remediation text and
control mappings (CIS, NIST 800-53, NIST 800-190, PCI-DSS, SLSA, OWASP).

| Category | Rules | Examples |
|---|---|---|
| Cloud | 5 | public bucket, publicly accessible database, `0.0.0.0/0` admin ingress, wildcard IAM, unencrypted storage |
| Kubernetes | 5 | privileged container, root container, missing resource limits, cluster-admin binding, host network |
| Container | 4 | fixable critical CVEs, `:latest` tag, unsigned image, elevated capabilities |
| Secrets | 3 | plaintext credential, secret in an env var, secret past rotation deadline |
| CI/CD | 4 | no scanning stage, write-all token, secret printed to logs, unprotected production deploy |

A rule is two functions over a `RuleContext` (the normalized signal, the asset
record, and a configuration snapshot):

```ts
appliesTo: (ctx) => boolean   // cheap pre-filter, skips rules that cannot match
evaluate:  (ctx) => RuleMatch // { matched, evidence?, severityOverride? }
```

`severityOverride` lets a rule escalate a specific instance — public *and*
production is worse than the same misconfiguration in a sandbox — without
forking the rule.

Two engine guarantees:

- **Evaluation is deterministic and side-effect free.** The same context always
  produces the same findings. That is what makes it safe to replay a new rule
  against retained signals instead of waiting for the estate to re-emit them.
- **A throwing rule is isolated.** The engine catches per rule and reports
  through `onError`; one bad rule cannot abort the batch. There is a test for
  exactly this.

STRATUS applies the catalog to itself. `CONTAINER-LATEST` fired on this
repository's own Kubernetes manifests, which is why the base now pins image tags.

---

## Prioritization

Priority is a paging decision, not a rounding of the score. Confidence is a
multiplier, so a high-scoring but weakly-correlated cluster does not wake
on-call:

```
weighted = riskScore x confidence

P1  production AND (weighted >= 70 OR (internet-exposed AND weighted >= 55))
P2  weighted >= 55 OR (production AND weighted >= 40)
P3  weighted >= 30 OR affectedAssets > 3
P4  otherwise
```

Suggested actions are a deterministic playbook lookup keyed on the hypothesis
and the finding set. No model in the loop, no invented advice, and each action
is flagged `automatable` or not. Nothing is executed — see Security below.

---

## Data model

Postgres holds the read model; Kafka holds the truth. The API queries Postgres
and never replays the log to answer a request.

- **`assets`** — the inventory. Indexed on `(organization_id, environment)` and
  `risk_score DESC`, the two access patterns the console actually has.
- **`findings`** — one row per rule/asset pair, `evidence` as `jsonb`,
  `compliance` and `references_urls` as arrays. Indexed on `(status, severity)`
  and `asset_id`. `ON DELETE CASCADE` from assets: a deleted asset cannot leave
  orphan findings behind.
- **`incidents`** — `timeline` and `suggested_actions` as `jsonb`, related asset
  and finding ids as arrays. Indexed on `(status, priority)` and
  `correlation_id`.
- **`risk_snapshots`** — hourly roll-up written by the risk engine, primary key
  `(bucket, organization_id, environment)`. Trend endpoints read this rather
  than aggregating over findings at query time.

Migrations are forward-only and applied files are recorded in
`schema_migrations`, never re-run. The migrator is a short `pg` script — no ORM,
no migration framework. ADR-0004 covers Postgres over a time-series store.

---

## API surface

```
GET  /v1/dashboard?window=7d        overview: score, counters, trend
GET  /v1/dashboard/risk-trend
GET  /v1/assets                     GET /v1/assets/summary
GET  /v1/findings                   GET /v1/findings/summary
GET  /v1/incidents                  GET /v1/incidents/summary   GET /v1/incidents/:id
GET  /v1/stream                     SSE, fanned out from Kafka
GET  /healthz  /readyz  /metrics    excluded from the v1 prefix
```

OpenAPI at `/docs`. The SSE stream is a Kafka consumer bridged to an RxJS
`Subject`, with a per-process group id so every replica delivers every event to
its own clients.

The console falls back to a bundled dataset when the API is unreachable, so a
fresh clone renders before the stack is up. Every fallback is labelled in the
UI — and that behaviour is itself listed as a gap, because a populated dashboard
in front of a dead API is a failure mode, not a feature.

---

## Quickstart

Requires Node 22+, pnpm 9 and Docker.

```bash
pnpm install
cp .env.example .env

pnpm infra:up                    # Kafka (KRaft), Postgres, Redis, Prometheus, Grafana, OTel
pnpm db:migrate
pnpm --filter @stratus/api seed  # deterministic demo estate

pnpm dev
```

| What | Where |
|---|---|
| Command Center | http://localhost:3000 |
| API docs | http://localhost:4000/docs |
| Grafana | http://localhost:3001 (admin / stratus) |
| Prometheus | http://localhost:9090 |

Generate traffic:

```bash
pnpm simulate -- --list
pnpm simulate -- --scenario deployment-incident --rate 4 --duration 120
```

`deployment-incident` is the scenario worth watching: a deploy, a latency
regression and a new critical finding on the same service, arriving minutes
apart. Three families inside the window, confidence above threshold, one P1 with
a timeline in the order things actually happened.

The broker exposes two listeners. From the host use `localhost:19092`
(`EXTERNAL`); inside the compose network services use `kafka:9092`
(`PLAINTEXT`). The `.env.example` defaults are the host view.

---

## Testing

```bash
pnpm test        # vitest, unit
pnpm test:e2e    # playwright, console
```

```
 ✓ tests/pipeline.spec.ts                                 (3 tests)
 ✓ packages/security-rules/src/engine.spec.ts             (8 tests)
 ✓ apps/event-processor/src/correlation/engine.spec.ts    (7 tests)
 ✓ apps/risk-engine/src/scoring.spec.ts                  (13 tests)
 ✓ packages/event-contracts/src/serialization.spec.ts     (6 tests)
 ✓ apps/incident-service/src/prioritization.spec.ts       (6 tests)

 Test Files  6 passed (6)
      Tests  43 passed (43)
```

`tests/pipeline.spec.ts` is the one that matters. It wires the real normalizers,
rule engine, correlation engine, scoring and prioritization together in-process
— no Kafka, no Postgres — and drives them with the same `deployment-incident`
scenario the simulator replays. If the demo stops producing a single P1, that
test goes red before anyone opens the console.

The unit tests cover the places where being wrong is expensive rather than the
places that are easy to test: scoring monotonicity and cap enforcement,
correlation windowing, eviction and confidence, priority thresholds at the
boundary, rule isolation when a rule throws, and contract validation with
dead-lettering.

Determinism is a design constraint, not a testing convenience.
`CorrelationEngine` takes an injectable clock, the seed data is deterministic,
and rule evaluation is pure. Nothing in the suite sleeps.

---

## Verified

| Check | Status |
|---|---|
| `pnpm install --frozen-lockfile` | Resolves the workspace; lockfile committed |
| `pnpm build` | Five packages, six services, console and simulator compile |
| `pnpm typecheck` | Clean, `strict` + `noUncheckedIndexedAccess` |
| `pnpm lint` | 0 errors (18 `no-explicit-any` warnings on database row mappers) |
| `pnpm test` | 43 tests, 6 files |
| `pnpm audit --audit-level high` | No known vulnerabilities at any severity |
| `trivy config infrastructure` | 0 HIGH/CRITICAL; 7 MEDIUM tracked, none suppressed |
| `next build` | Compiles and prerenders all six routes |
| `pnpm test:e2e` | Written; needs Playwright browsers |

One thing to know before the first build: the console loads IBM Plex through
`next/font/google`, so a production build needs network access to Google Fonts.
Swap in a local font for air-gapped builds.

---

## Deployment

**Docker** — `infrastructure/docker`: the local stack plus multi-stage, non-root
images for every service. The service image is one Dockerfile parameterized by
`ARG SERVICE`, so six services do not mean six Dockerfiles to keep in sync.

**Kubernetes** — `infrastructure/kubernetes`: kustomize base plus a production
overlay. Restricted Pod Security at the namespace, default-deny NetworkPolicy
with an explicit allow list, read-only root filesystem, all capabilities
dropped, `runAsNonRoot` with uid/gid 10001, pinned image tags. The HPA scales on
`stratus_consumer_lag_messages` as well as CPU — lag is what an operator
actually feels when the pipeline falls behind.

**Terraform** — `infrastructure/terraform`: private VPC, MSK with encryption in
transit and at rest under a customer-managed KMS key, encrypted RDS with IAM
database authentication, serverless ElastiCache. Nothing in the module is
publicly reachable.

---

## Observability

Every service exposes `/healthz`, `/readyz` and `/metrics`, exports traces over
OTLP, and logs structured JSON with the active trace id attached. Payload bodies
are never logged.

Alerting is built around the failure mode that is hardest to notice — the
pipeline going quiet, which looks exactly like a healthy estate:

| Alert | Means |
|---|---|
| `StratusIngestionStalled` | No signals for 15 minutes |
| `StratusConsumerLagGrowing` | Detections are being delayed |
| `StratusDeadLetterSpike` | Contract violations or handler failures |
| `StratusRiskDegrading` / `StratusCriticalFindingsOpen` | Posture regressions |

A provisioned Grafana dashboard for the pipeline ships in
`observability/grafana/dashboards`.

---

## Security

STRATUS is **read-only with respect to the infrastructure it observes**. It
holds no remediation credentials and has no write path into any cloud account;
suggested actions are text. This is the most important decision in the threat
model, because it caps the blast radius of a full platform compromise at
disclosure and denial of service — it cannot be turned into a lateral movement
tool.

- [Threat model](docs/security/threat-model.md) — trust boundaries, assets, 14
  threats in STRIDE with the control covering each
- [Hardening](docs/security/hardening.md) — every control, the file implementing
  it, and the catalog rule that would fire if it regressed
- [Known gaps](docs/security/known-gaps.md) — the part most projects leave out

The two critical gaps, stated plainly: **there is no authentication** on the API
or the console, and **collector webhooks are unsigned**. `organizationId` flows
through every envelope and query but nothing enforces it. That is the next thing
to build.

CI runs CodeQL (`security-extended`), `pnpm audit` gated at HIGH with no ignore
list, and a Trivy IaC scan gated at HIGH/CRITICAL. GitHub Actions are pinned;
`trivy-action` is pinned by commit SHA because every tag from 0.0.1 to 0.34.2
was rewritten during the March 2026 supply-chain compromise.

---

## Decisions

| ADR | Decision |
|---|---|
| [0001](docs/adr/0001-event-driven-architecture.md) | Event-driven architecture on Kafka |
| [0002](docs/adr/0002-typescript-only-stack.md) | TypeScript everywhere, no Python |
| [0003](docs/adr/0003-explainable-risk-scoring.md) | Additive, explainable risk scoring |
| [0004](docs/adr/0004-postgres-for-incidents.md) | PostgreSQL for incidents and the read model |
| [0005](docs/adr/0005-correlation-topic-extension.md) | An internal correlation topic |

---

## Layout

```
apps/            six services + the Next.js console
packages/        shared-types · event-contracts · security-rules · config · observability
tools/           event simulator
infrastructure/  docker · kubernetes · terraform
observability/   prometheus · grafana · opentelemetry
docs/            architecture · diagrams · security · adr
```

Shared code is split by *contract stability*, not by convenience.
`shared-types` has no dependencies at all. `event-contracts` owns the envelope,
the topic specs and the Kafka binding — the things every service must agree on.
`security-rules` is pure domain logic with no I/O, which is why it is testable
without a broker.

## Status

Portfolio project, actively built. Authentication and multi-tenant isolation are
stubbed. See [known gaps](docs/security/known-gaps.md).

## License

Apache 2.0 — see [LICENSE](LICENSE).
