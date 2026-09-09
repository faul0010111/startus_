# Contributing

## Getting set up

```bash
pnpm install
pnpm infra:up
pnpm db:migrate
pnpm dev
```

## Before opening a pull request

```bash
pnpm lint
pnpm typecheck
pnpm test
```

## Adding a collector

1. Write a normalizer in `apps/signal-engine/src/normalizers/` that returns
   `NormalizedSignal[]`.
2. Register it in `normalizers/index.ts` and add the name to `SUPPORTED_SOURCES`.
3. Nothing downstream changes — that is the point of the boundary.

## Adding a security rule

1. Add it to the matching file in `packages/security-rules/src/rules/`.
2. Give it a stable id, a severity, remediation text and at least one control
   mapping. Rules without remediation are noise.
3. Cover it in `packages/security-rules/src/engine.spec.ts`, including the case
   where it must stay quiet.

## Changing an event contract

Payload schemas live in `packages/event-contracts/src/payloads.ts`. Additive
changes are safe. Anything breaking needs a version bump on the envelope and a
note in an ADR — consumers validate on read and will dead-letter what they
cannot parse.
