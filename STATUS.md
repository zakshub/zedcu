# ZEDCU Status

**Updated:** 2026-10-20  
**Repository:** `zakshub/zedcu`  
**Default branch:** `main`  
**Implementation branch:** `feat/phase-1-runtime-baseline`  
**Pull request:** [#2 — Phase 1 runtime foundation](https://github.com/zakshub/zedcu/pull/2) — draft, not merged  
**Current rule:** Do not merge, provision infrastructure, or deploy without Zak's explicit approval.

## Latest repository and CI evidence

The branch HEAD before this status update was `5da9460f54c4b7875469980e4b649dbbb58a6a7a`. Two GitHub Actions CI runs on that exact SHA completed successfully:
- [Run 39442753511](https://github.com/zakshub/zedcu/actions/runs/39442753511) — success.
- [Run 39442745159](https://github.com/zakshub/zedcu/actions/runs/39442745159) — success.

The latest full code verification remains [run #411](https://github.com/zakshub/zedcu/actions/runs/39442579375) on commit `ddfbb2900766fd6028da5762a3cdde3030cfb47f`:
- 93 unit tests passed across 18 test files.
- TypeScript typecheck, build, lint, and high-severity dependency audit passed.
- PostgreSQL 16 schema/migration checks and five live integration tests passed.
- Includes the cancellation watcher, Raza GitHub evidence auditor, and deterministic Sirfaraz planning preview.

The two latest runs validate the then-current branch HEAD, including documentation changes. The full 93-test report is from run #411; do not describe documentation-only runs as rerunning all tests unless their job evidence confirms that.

## Implemented

- Strict TypeScript baseline, Node 22 lockfile, and deterministic `npm ci` CI installs.
- Provider contracts, generic OpenAI-compatible adapter, gateway registry, capability/priority routing, bounded fallback, and fail-closed free-route metadata gate.
- PostgreSQL TaskStore and durable queue with leases, idempotency, audit events, checkpoints, atomic task-plus-queue submission, and atomic requeue on resume.
- Authenticated HTTP task API for submission, listing, inspection, constrained state actions, readiness, and health.
- Responsive starter dashboard for token-based connection, task submission, history, inspection, checkpoints, and basic task actions. The token is held in page memory rather than browser storage.
- Deterministic zero-cost Sirfaraz planning preview at authenticated `POST /v1/plan`. It returns a heuristic plan with scope boundaries, a specialist suggestion, stop conditions, and approval flags. It does not call a model, persist the plan, approve the task, or execute the plan.
- Read-only Raza task-record audit endpoint and GitHub evidence endpoint at authenticated `GET /v1/audit/github`.
- Raza's GitHub audit compares the configured branch HEAD SHA with CI runs for that exact SHA and requires successful `checks` and `postgres-schema` jobs. It fails closed when evidence is missing.
- Worker cancellation watcher that checks durable task state and aborts the provider request through an AbortSignal when the task is paused/cancelled or state cannot be verified. This depends on the upstream adapter honoring the signal; it is not a guarantee that every provider can be forcibly interrupted.
- Backup/recovery runbook, free-tier database evaluation, runtime quick-start, agent profiles, and project documentation.

## Not yet implemented or verified

- No hosted database or cloud runtime has been provisioned; no deployment has occurred.
- No real model/provider route has been configured or called. Free status remains operator-attested metadata, not independently proven billing status.
- No persistent Sirfaraz plan record, plan-version approval record, or approval invalidation when scope changes.
- No natural-language orchestration or real dispatch/execution of the 15 specialist roles.
- Raza is not a separately isolated service or scheduled monitor; the current auditor is a read-only module/API endpoint in the API process.
- No authenticated task-driven GitHub execution workflow, notifications, multi-user accounts, or production-grade role-based permissions.
- The adapter supports OpenAI-compatible chat completions; native provider protocols require dedicated adapters.
- Bearer-token authentication is a starter boundary, not a production identity and authorization system.
- No scheduled backups or successful production restore drill.
- No live end-to-end run through a verified free model route.

## Current milestones

1. **Safe model routing:** adapter and policy baseline implemented; verify concrete free routes, usage, quota, and cost evidence.
2. **Durable tasks and approvals:** core task persistence exists; add durable plans, approval records, version binding, and stale-approval protection.
3. **Sirfaraz orchestration:** preview exists; implement plan persistence, execution coordination, specialist contracts, and dispatch.
4. **Specialist team:** names/profiles exist; implement enforced role permissions and executable specialist workers.
5. **Independent Raza:** audit endpoints exist; isolate the monitor, schedule checks, and report discrepancies.
6. **GitHub workflow:** implement least-privilege issue/branch/diff/CI operations with explicit approval for consequential changes.
7. **Control dashboard:** add plan review, approval inbox, step-level observability, artifacts, provider evidence, and cost-stop visibility.
8. **Cloud runtime:** select and provision only after current free-tier validation and explicit approval; then add backups and recovery drills.
9. **Release readiness:** end-to-end, security, zero-cost, recovery, and independent audit evidence before requesting merge/deployment approval.

The authoritative detailed task list and milestone acceptance criteria are in [docs/ROADMAP.md](https://github.com/zakshub/zedcu/blob/feat/phase-1-runtime-baseline/docs/ROADMAP.md).

## Immediate execution sequence

1. Add typed plan/approval data contracts and durable storage.
2. Link Sirfaraz plans to task records while keeping planning separate from approval and execution.
3. Add mocked-gateway end-to-end worker tests.
4. Enforce approvals at the execution boundary and test stale-plan rejection.
5. Separate Raza into a read-only monitoring service.
6. Verify official free-model terms and cost evidence.
7. Extend the dashboard and prepare deployment only after owner approval.

## Financial, security, and release policy

Hard limit: USD $0/month. No paid fallback, credit purchases, automatic upgrades, or unapproved spending. If free eligibility or cost is uncertain, do not invoke the route. Never commit secrets. Multiple gateways do not multiply upstream free quota. A passing CI run is evidence of code checks, not proof of deployment or a guarantee of zero upstream billing.
