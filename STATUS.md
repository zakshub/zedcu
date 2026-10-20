# ZEDCU Status

**Updated:** 2026-10-20  
**Repository:** `zakshub/zedcu`  
**Default branch:** `main`  
**Implementation branch:** `feat/phase-1-runtime-baseline`  
**Pull request:** [#2 — Phase 1 runtime foundation](https://github.com/zakshub/zedcu/pull/2) — draft, not merged

## Latest verified code

GitHub Actions run [#411](https://github.com/zakshub/zedcu/actions/runs/39442579375) passed both jobs on commit `ddfbb2900766fd6028da5762a3cdde3030cfb47f`:
- 93 unit tests passed.
- TypeScript typecheck, build, lint, and high-severity dependency audit passed.
- PostgreSQL 16 schema/migration checks and five live integration tests passed.
- Includes active-request cancellation, Raza GitHub evidence auditing, and the deterministic Sirfaraz plan-preview endpoint.

## Implemented

- Strict TypeScript baseline, Node 22 lockfile, and deterministic `npm ci` CI installs.
- Provider contracts, free-only route policy, gateway registry, capability/priority routing, bounded fallback, and a generic OpenAI-compatible adapter.
- Multi-route worker configuration with server-side secrets, per-route evidence metadata, priority order, bounded fallback, and shutdown draining.
- PostgreSQL TaskStore and durable queue with leases, idempotency, audit events, checkpoints, atomic task + queue submission, and atomic re-queue on resume.
- Authenticated HTTP task API with health/readiness, idempotent task submission, listing, inspection, constrained state actions, and a deterministic zero-cost Sirfaraz planning preview at `POST /v1/plan`.
- Basic responsive control dashboard served by the API. It supports token-based connection, task submission, history, checkpoint inspection, task actions, and a read-only Raza task-record audit. The token remains in page memory rather than browser storage.
- Read-only Raza auditors: persisted task-record invariants and GitHub branch HEAD/CI job evidence via authenticated `GET /v1/audit/github`. The GitHub auditor verifies matching SHA and required job conclusions, but remains in the API process rather than a separately deployed service.
- PostgreSQL-backed worker entry point and runtime start scripts.
- Backup/recovery runbook, free-tier database comparison, and runtime quick-start instructions.

## Latest engineering change in progress

- Added a durable task-state cancellation watcher for active provider requests. GitHub Actions passed typecheck, unit tests, build, lint, and dependency audit for the change; PostgreSQL integration also passed.
- Added a read-only Raza GitHub evidence auditor and authenticated `GET /v1/audit/github` endpoint. It compares the configured branch HEAD SHA with CI runs for that exact SHA and requires successful `checks` and `postgres-schema` jobs. The endpoint is read-only and fails closed if evidence is missing. CI run #401 passed for this addition. This is an auditor module and endpoint, not yet a separately deployed service.

## Not yet implemented or verified

- No persistent hosted database or cloud runtime has been provisioned; no deployment has occurred.
- No live model/provider has been configured or called; route free status remains operator-attested, not independently checked against live billing.
- No scheduled backup or successful production restore drill.
- Sirfaraz's natural-language command/orchestration layer and all 15 specialist execution roles are not implemented.
- Raza is now implemented as a read-only GitHub evidence auditor module and authenticated endpoint, but it is not yet deployed as a separately isolated service or scheduled monitor.
- No authenticated GitHub execution workflow, notifications, multi-user accounts, or role-based permissions.
- The current adapter supports OpenAI-compatible chat completions; native-provider protocols need their own adapters.
- A single bearer token is starter authentication, not a production identity/permission system.
- Pause/cancel state changes are checked after the current model request returns; this is not yet hard cancellation of an in-flight upstream request.

## Immediate next steps

1. Verify the latest documentation-only CI runs.
2. Test API + worker together against an approved disposable PostgreSQL instance.
3. Verify official free-tier terms for at least two concrete models before configuring route entries.
4. Add a full end-to-end worker test with mocked gateways and improve in-flight cancellation semantics.
5. Implement Sirfaraz task planning and specialist dispatch, then build Raza as a separate read-only service that independently checks repository/CI evidence.
6. Only after explicit approval, select a host, configure secrets, perform a restore drill, and deploy. Do not merge PR #2 or provision paid services without Zak's approval.

## Financial and safety policy

No paid fallback, credit purchases, automatic upgrades, or unapproved deployment. If free eligibility or cost is uncertain, do not run the route. Do not commit secrets. A passing CI run is evidence of code checks, not proof of production deployment or a guarantee of zero upstream billing.
