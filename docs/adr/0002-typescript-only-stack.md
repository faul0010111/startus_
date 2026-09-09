# ADR-0002: TypeScript across the whole stack, no Python

- **Status:** Accepted
- **Date:** 2026-09-07

## Context

Security tooling defaults to Python. The requirement for this project is
explicitly to avoid it. Beyond the constraint, a mixed-language monorepo pays a
tax on every shared type: the domain model has to be defined twice and drift is
only caught in production.

## Decision

Every runtime component is TypeScript on Node 22: services, console, simulator
and tooling. Domain types live in `@stratus/shared-types` and are imported by
both the backend and the frontend.

## Consequences

**Good.** One toolchain, one test runner, one lint config. The `Incident` type
the console renders is the exact type the incident service writes. Contributors
need one language to work anywhere in the repo.

**Bad.** CPU-bound analysis (large-scale graph correlation, ML scoring) is not
Node's strength. If that becomes necessary, ADR-0001 makes it cheap to add a Go
consumer without touching anything else — the bus is the integration point.

**Alternatives rejected.** Go for the workers would have been a better fit for
throughput, at the cost of duplicating the domain model. Python for the rule
engine was ruled out by the project constraint.
