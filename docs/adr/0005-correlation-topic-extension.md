# ADR-0005: An internal `stratus.correlation.detected` topic

- **Status:** Accepted
- **Date:** 2026-09-07

## Context

The base topic set covers signals, findings, deployments, performance alerts,
risk updates and incidents. It has no name for the intermediate artifact the
correlation engine produces: a cluster of related events that is not yet an
incident and may never become one.

Without a topic for it, the event processor would have to create incidents
itself, collapsing two responsibilities — deciding that signals are related, and
deciding that a relation is worth paging someone about — into one service.

## Decision

Add `stratus.correlation.detected` as an internal topic with 14-day retention.
The event processor publishes clusters; the risk engine and the incident service
consume them independently.

## Consequences

**Good.** Correlation confidence and incident priority are tuned separately.
The risk engine can score a cluster without an incident existing. Clusters below
the publish threshold are simply never emitted, which keeps the incident table
clean.

**Bad.** One more topic to provision and monitor, and a name that is not part of
the original contract — documented here so it does not look like drift.
