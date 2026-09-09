# ADR-0004: PostgreSQL for incidents and the read model

- **Status:** Accepted
- **Date:** 2026-09-07

## Context

Most platform state is derivable from the stream. Incidents are not: they carry
human context (status changes, ownership) and must survive a topic replay
without being recreated with new ids.

## Decision

Incidents, the console read model and hourly risk snapshots live in PostgreSQL.
Redis holds only hot, rebuildable state: asset context and per-asset risk
roll-ups. Kafka remains the system of record for what happened.

## Consequences

**Good.** The console gets the aggregate queries it needs (`GROUP BY severity`,
time-bucketed trends) without inventing a query layer over the stream. Losing
Redis degrades scoring for minutes; losing it never loses an incident.

**Bad.** A second write path to keep consistent, and a migration story. The
mitigation is that incident writes are idempotent upserts keyed by correlation
key, so a replay converges rather than duplicating.

**Alternatives rejected.** Kafka Streams state stores would have avoided the
database but made ad-hoc queries and the SSE fan-out considerably harder.
