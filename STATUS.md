# ZEDCU Status

**Updated:** 2026-10-17  
**Repository:** `zakshub/zedcu`  
**Default branch:** `main`  
**Implementation branch:** `feat/phase-1-runtime-baseline`  
**Pull request:** [#2 — Phase 1 runtime foundation](https://github.com/zakshub/zedcu/pull/2) — draft, not merged

## Latest verified code

GitHub Actions run [#323](https://github.com/zakshub/zedcu/actions/runs/39053502810) passed both jobs on code commit `4ccf584ddf0af4c66e7f65c9ff99fa6d377cf531`:
- 76 unit tests passed.
- TypeScript typecheck, build, lint, and high-severity dependency audit passed.
- PostgreSQL 16 schema/migration checks and four live integration tests passed.

Subsequent changes update documentation only and have separate CI runs.

## Implemented

- Strict TypeScript baseline, Node 22 lockfile, and deterministic `npm ci` CI installs.
- Provider contracts, free-only route policy, gateway registry, capability/priority routing, bounded fallback, and a generic OpenAI-compatible adapter.
- Multi-route worker configuration with server-side secrets, per-route evidence metadata, priority order, bounded fallback, and shutdown draining.
- PostgreSQL TaskStore and durable queue with leases, idempotency, audit events, checkpoints, and atomic task + queue submission.
- Authenticated HTTP task API with health/readiness, idempotent task submission, listing, inspection, and constrained state actions.
- Basic responsive control dashboard served by the API. It supports token-based connection, task submission, history, checkpoint inspection, and supported task state actions. The token remains in page memory rather than browser storage.
- PostgreSQL-backed worker entry point and runtime start scripts.
- Backup/recovery runbook, free-tier database comparison, and runtime quick-start instructions.

## Not yet implemented or verified

- No persistent hosted database or cloud runtime has been provisioned; no deployment has occurred.
- No live model/provider has been configured or called; route free status remains operator-attested, not independently checked against live billing.
- No scheduled backup or successful production restore drill.
- Sirfaraz's natural-language command/orchestration layer and all 15 specialist execution roles are not implemented.
- Raza's separate read-only verification service is not implemented.
- No authenticated GitHub execution workflow, notifications, multi-user accounts, or role-based permissions.
- The current adapter supports OpenAI-compatible chat completions; native-provider protocols need their own adapters.
- A single bearer token is starter authentication, not a production identity/permission system.

## Immediate next steps

1. Verify the latest documentation-only CI runs.
2. Test API + worker together against an approved disposable PostgreSQL instance.
3. Verify official free-tier terms for at least two concrete models before configuring route entries.
4. Implement integration tests for multi-route worker execution and crash/restart recovery.
5. Implement Sirfaraz task planning and specialist dispatch, then the independent Raza auditor.
6. Only after explicit approval, select a host, configure secrets, perform a restore drill, and deploy. Do not merge PR #2 or provision paid services without Zak's approval.

## Financial and safety policy

No paid fallback, credit purchases, automatic upgrades, or unapproved deployment. If free eligibility or cost is uncertain, do not run the route. Do not commit secrets. A passing CI run is evidence of code checks, not proof of production deployment or a guarantee of zero upstream billing.
