# ADR-0003: Additive, explainable risk scoring

- **Status:** Accepted
- **Date:** 2026-09-07

## Context

Risk scores get ignored when nobody can explain them. An operator asked to drop
what they are doing needs to know why this asset outranks the other forty.

## Decision

`scoreRisk()` is a pure function that returns both a score and the list of
factors that produced it: severity, business context (criticality × environment),
internet exposure, age, related findings and incident history. Each factor
reports its own contribution, and the console renders them.

Age grows logarithmically and each secondary factor is capped, so no single
input can dominate. Aggregation across the estate is a weighted blend of the
worst asset and the mean, not a plain average — one severe production asset
should move the number.

## Consequences

**Good.** Deterministic and unit-testable; the same input always produces the
same score, which is what makes replay safe. Tuning is a matter of changing
named constants rather than retraining anything.

**Bad.** It cannot learn. Weights are chosen, not derived, and they will be
wrong for some estates. The factor list is the mitigation: a wrong score is at
least a legible one.

**Alternatives rejected.** A trained model would score better on paper and
would not survive the first "why did this page me at 3am?".
