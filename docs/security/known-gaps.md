# Known gaps

The part most projects leave out. Everything below is a real weakness in the
current implementation, not a hypothetical. Ordered by how much it would matter
in a production deployment.

## 1. No authentication anywhere — critical

Neither `stratus-api` nor the console requires identity. `organizationId` is
threaded through every envelope, every query and every read-model row, so the
data model is ready for multi-tenancy, but nothing enforces the boundary. Any
client that reaches the API reads every finding for every tenant.

**Impact:** full disclosure of the incident and asset inventory (T7 in the
threat model).
**Compensating control:** no public endpoints exist in the Terraform module;
everything sits behind the cluster ingress and a default-deny NetworkPolicy.
**Fix:** OIDC on the API, session handling in the console, and an
`organizationId` guard applied at the repository layer rather than the
controller.

## 2. Collector webhooks are unauthenticated — critical

`POST /v1/signals/:source` accepts any well-formed envelope. Schema validation
rejects malformed payloads, but a well-formed forgery is indistinguishable from
a real signal. An attacker who can reach `signal-engine` can manufacture
findings or bury real ones under noise (T1, T10).

**Fix:** per-source HMAC signing with rotating keys, plus a rate limit per
source. The `source` path parameter already gives the natural key scope.

## 3. No service-to-service authentication on the bus — high

Any workload that reaches Kafka can produce to any topic, including
`incidents.*`. Isolation today is purely network-level: MSK in private subnets
plus the default-deny policy (T2).

**Fix:** SASL/mTLS on MSK with per-service principals and topic ACLs.

## 4. No audit trail — medium

There is no record of who viewed, acknowledged or dismissed an incident (T6).
The blast radius is bounded because suggested actions are advisory and STRATUS
never writes back to infrastructure, but the platform cannot answer "who saw
this first" — a question that matters during a real incident review.

**Fix:** an append-only audit table in the read model, written on every
state-changing API call, once authentication lands (it is meaningless before).

## 5. No envelope provenance — medium

Envelopes are validated against their contract but not signed. A producer with
bus access can emit a syntactically perfect event attributed to another service
(T3). Determinism helps — replaying the rule engine over retained signals
reproduces the verdict — but there is no way to prove which service originated a
given event.

**Fix:** sign the envelope header with the producing service's key; verify on
consume before handing off to the handler.

## 6. Secrets handling is deployment-dependent — medium

`POSTGRES_URL` comes from a Kubernetes secret in the manifests, which is
correct, but Kubernetes secrets are base64, not encrypted, unless the cluster
enables encryption at rest or an external store. The repository cannot enforce
that.

**Fix:** External Secrets Operator or CSI driver backed by the KMS key the
Terraform module already provisions.

## 7. Trivy MEDIUM/LOW findings are unaddressed — low

The IaC gate is HIGH/CRITICAL and currently passes clean. Below the gate there
are findings in `kubernetes/base/workers.yaml`, `api-deployment.yaml`, the
Terraform module and `infrastructure/docker/Dockerfile.console`. They are real
and simply have not been worked through.

**Fix:** triage them and either resolve or record an explicit, justified
ignore — never a blanket suppression.

## 8. Console fetches over plain HTTP by default — low

`NEXT_PUBLIC_STRATUS_API_URL` defaults to `http://localhost:4000`, which is
right for local development and wrong everywhere else. Nothing in the code
forces TLS on the deployed value.

**Fix:** reject non-HTTPS values when `NODE_ENV=production` in the config
schema.

## 9. Demo data can be mistaken for live data — low

The console falls back to a bundled dataset when the API is unreachable, so a
fresh clone renders something. Every fallback is flagged in the UI, but the
mechanism means an operator staring at a broken API sees a populated dashboard
rather than an error.

**Fix:** make the demo fallback opt-in via an environment flag, off by default
in production builds.

## 10. Dependency exceptions

None. The audit gate runs at HIGH with no ignore list, and the workspace
currently reports zero known vulnerabilities at any severity. Two `pnpm`
overrides exist — `multer` and `postcss` — and both exist to *raise* a
transitive dependency that its parent pins to a vulnerable exact version. If a
suppression is ever added here, it belongs in this document with a date and a
reason.

---

## Not gaps

Worth stating explicitly, because these look like omissions and are not:

- **No remediation credentials.** STRATUS is read-only with respect to observed
  infrastructure by design. This caps the blast radius of a full compromise at
  disclosure and denial of service.
- **No secret values in findings.** The `secrets` rule category reports the
  location and rule id of a detected credential, never the captured material.
- **`automountServiceAccountToken: false`.** Deliberate; the token is mounted
  only where the collector actually needs it.
