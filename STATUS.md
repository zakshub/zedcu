# ZEDCU Status

**Updated:** 2026-10-17  
**Repository:** `zakshub/zedcu`  
**Default branch:** `main`  
**Implementation branch:** `feat/phase-1-runtime-baseline`  
**Pull request:** [#2 — Phase 1 runtime foundation](https://github.com/zakshub/zedcu/pull/2) — draft, not merged

## Latest verified code

GitHub Actions run [#291](https://github.com/zakshub/zedcu/actions/runs/39053012186) passed both jobs on commit `8c5766948d7832bede674eabdc65f6dc592100c`:
- 69 unit tests passed.
- TypeScript typecheck, build, lint, and high-severity dependency audit passed.
- PostgreSQL 16 schema/migration checks and four live integration tests passed.

The follow-up commits update documentation and are being checked separately.

## Implemented

- Strict TypeScript baseline, Node 22 lockfile, and deterministic `npm ci` CI installs.
- Provider contracts, free-only route policy, gateway registry, capability/priority routing, and bounded fallback.
- Generic OpenAI-compatible adapter with server-side credentials, HTTPS for remote endpoints, normalized failures, usage extraction, and cancellation.
- Configurable multi-route worker that attempts only explicitly attested zero-cost routes with recent HTTPS evidence metadata.
- PostgreSQL TaskStore and durable queue with leases, idempotency, audit events, checkpoints, and atomic task + queue submission.
- Authenticated HTTP task API with health/readiness, idempotent task submission, listing, inspection, and constrained state actions.
- PostgreSQL-backed worker entry point and runtime start scripts.
- Backup/recovery runbook, free-tier database comparison, and runtime quick-start instructions.

## Not yet implemented or verified

- No persistent hosted database or cloud runtime has been provisioned; no deployment has occurred.
- No live model/provider has been configured or called; route free status remains operator-attested, not independently checked against live billing.
- No scheduled backup or successful production restore drill.
- Sirfaraz's natural-language command/orchestration layer and all 15 specialist execution roles are not implemented.
- Raza's separate read-only verification service is not implemented.
- No mobile dashboard, multi-user authentication, notifications, or authenticated GitHub execution workflow.
- The current worker uses OpenAI-compatible chat completions. Native-provider protocols need their own adapters.
- A single bearer token is starter authentication, not a production identity/permission system.

## Immediate next steps

1. Confirm CI for the newest documentation commits.
2. Test API + worker together against an approved disposable PostgreSQL instance.
3. Verify official free-tier terms for at least two concrete models before configuring route entries.
4. Add runtime tests for multi-route fallback and worker restart/recovery.
5. Implement Sirfaraz task planning and specialist dispatch, then the independent Raza auditor.
6. Only after explicit approval, select a host, configure secrets, perform a restore drill, and deploy. Do not merge PR #2 or provision paid services without Zak's approval.

## Financial and safety policy

No paid fallback, credit purchases, automatic upgrades, or unapproved deployment. If free eligibility or cost is uncertain, do not run the route. Do not commit secrets. A passing CI run is evidence of code checks, not proof of production deployment or a guarantee of zero upstream billing.
