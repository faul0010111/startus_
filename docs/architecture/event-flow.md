# Event flow

## Contract

Every message carries the same envelope:

```json
{
  "eventId": "uuid",
  "eventType": "security.finding.detected",
  "timestamp": "2026-09-07T12:00:00.000Z",
  "source": "security-engine",
  "organizationId": "org_demo",
  "projectId": "proj_demo",
  "environment": "production",
  "correlationId": "svc:production:checkout",
  "version": "1.0",
  "payload": {}
}
```

Payloads are validated with Zod on the way in, not on the way out — a producer
cannot poison a consumer, and a consumer never trusts the wire.

## Topics

| Topic | Partitions | Retention | Notes |
| --- | --- | --- | --- |
| `stratus.signal.received` | 12 | 7d | Highest volume, keyed by resource id |
| `stratus.correlation.detected` | 6 | 14d | Internal; see ADR-0005 |
| `stratus.security.finding.detected` | 6 | 30d | |
| `stratus.security.finding.updated` | 6 | 30d | |
| `stratus.asset.discovered` | 6 | 30d | Compacted: latest state per asset |
| `stratus.deployment.completed` | 3 | 30d | |
| `stratus.performance.alert` | 6 | 7d | |
| `stratus.risk.score.updated` | 6 | 90d | Compacted |
| `stratus.incident.created` / `.updated` | 3 | 90d | |
| `stratus.system.alert` | 3 | 7d | Platform self-monitoring |

Each topic has a matching `<topic>.dlq`, created at boot by `KafkaBus.ensureTopics()`.

## The flagship path

A deployment lands on `checkout`. Within fifteen minutes latency degrades and a
new privileged-container finding appears on the same workload. The correlation
engine sees three signal families sharing one key, raises confidence above the
publish threshold, and the incident service opens a single P1 with a timeline
that reads in the order things actually happened — instead of three separate
alerts arriving in three separate channels.

Reproduce it with:

```bash
pnpm simulate -- --scenario deployment-incident
```
