# ADR-0001: Event-driven architecture on Kafka

- **Status:** Accepted
- **Date:** 2026-09-07

## Context

STRATUS ingests signals from sources that have nothing in common except that
they describe the same infrastructure. Detection logic changes weekly; the
sources change monthly. A request/response design would couple every collector
to every consumer and make rule iteration a deployment problem.

## Decision

All inter-service communication goes through a Kafka event bus with a versioned
envelope. Services own consumer groups; nobody calls anybody else synchronously.

## Consequences

**Good.** New rules can be replayed against seven days of retained signals. A
slow consumer cannot stall ingestion. The incident timeline is derived from real
events rather than reconstructed after the fact.

**Bad.** Eventual consistency is visible to operators: a finding may appear in
the feed before it is queryable in the read model. Local development needs a
broker running, which is why `pnpm infra:up` exists. Debugging spans processes,
which is why OpenTelemetry is not optional here.

**Alternatives rejected.** A monolith with an internal queue would have been
faster to build and impossible to scale per stage. Serverless functions per
signal would have made correlation windows painful to hold in memory.
