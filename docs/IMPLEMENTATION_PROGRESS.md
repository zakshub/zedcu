# Implementation Progress

Updated: 2026-10-17

GitHub Actions run #362 passed both jobs on code commit `45f9bbfd3498047d8733612e9874d663486bfb57`: 81 unit tests, typecheck, build, lint, high-severity dependency audit, PostgreSQL schema checks, and five live PostgreSQL integration tests. This verifies the authenticated API, responsive dashboard, generic multi-route worker, idempotent task submission, atomic resume/re-queue, and initial read-only Raza task-record audit. Later commits update documentation only; their CI runs are in progress.

## Implemented in this branch (latest code verification: run #362)

- Strict TypeScript project baseline and npm scripts.
- Provider request/response contracts, normalized failure categories, and a tested generic OpenAI-compatible chat-completions adapter with HTTPS enforcement for remote endpoints, server-side credentials, token usage extraction, normalized errors, and cancellation support.
- Pluggable gateway registry with enable/disable metadata, protocol/capability descriptors, and duplicate-ID protection.
- Capability-aware route selection with explicit priority ordering, cooldown filtering, and required task capabilities; the free-only policy remains the hard gate.
- Gateway-neutral integration strategy covering OmniRoute, OpenRouter, direct providers, and candidate gateways such as LiteLLM, Bifrost, Portkey Gateway, New API, Agent Router / Envoy AI Gateway, Kong AI Gateway, and Cloudflare AI Gateway. A generic OpenAI-compatible adapter is implemented; no specific real provider is yet configured or approved.
- Free-route policy requiring explicit zero-cost evidence checked within 30 days.
- Bounded fallback runner with per-route attempt records, duplicate-route prevention, retryable-failure handling, per-request timeout, cooperative cancellation signal, and fail-closed rejection when zero cost is not explicitly reported.
- Guarded task-state transitions, task records, ordered audit events, a storage interface, and a single-process JSON store with atomic replacement, optimistic version checks, and restart-read tests.
- Task service for task creation, state transitions, numbered checkpoints, and audit events.
- `TaskService.submit()` routes submissions through an atomic store operation and fails closed when the selected store cannot create the task and queue entry together.
- In-memory queue adapter for development/tests and PostgreSQL queue adapter with row-lock claims using `SKIP LOCKED`, lease expiry/reclaim, acknowledgement, and retry release.
- PostgreSQL schema migration for tasks, checkpoints, ordered audit events, durable idempotency keys, queue status, and lease ownership constraints.
- PostgreSQL TaskStore with optimistic version checks, transaction-protected history writes, and `createQueued()` to insert task, checkpoints, audit history, and queue row in one transaction.
- PostgreSQL pool factory resolving `DATABASE_URL` or `PGHOST`/`PGPORT`/`PGDATABASE`/`PGUSER`/`PGPASSWORD`, with validated pool limits and optional certificate-verified SSL. No secrets are logged or committed.
- Live PostgreSQL integration tests for TaskService submission/persistence, rollback, concurrent worker claims, expired lease reclaim, and stale-token rejection.
- Pool configuration unit tests for missing settings, SSL, connection URL, and invalid numeric values.
- GitHub Actions workflow for typecheck, tests, build, lint, high-severity dependency audit, migration validation, and live PostgreSQL integration testing.
- Committed `package-lock.json` generated with Node.js 22/npm 10.9.9. Clean `npm ci`, typecheck, 51 unit tests, build, lint, and the high-severity audit gate passed. Both CI jobs, including live PostgreSQL integration tests, passed on run #231.
- Free-tier database comparison documented in `docs/FREE_TIER_DATABASE_EVALUATION.md`. Aiven and Neon are shortlisted for evaluation; no provider has been selected or provisioned.
- Vitest upgraded after CI identified critical dependency advisories; the high-severity audit gate passes.


- Authenticated HTTP API in `src/http/api-server.ts` with liveness/readiness, idempotency-keyed task submission, task listing/inspection, constrained pause/resume/cancel/approval actions, constant-time bearer-token comparison, JSON size limits, safe error responses, and a same-origin responsive dashboard protected by a restrictive content-security policy.
- Runtime API entry point `src/http/main.ts` and PostgreSQL-backed worker entry point `src/worker/main.ts`; scripts are `npm start` and `npm run start:worker`.
- Worker supports a configurable list of OpenAI-compatible routes with explicit zero-cost metadata, recent HTTPS evidence links, priority order, and bounded fallback; routes are refused unless the operator explicitly confirms free eligibility and zero cost.
- Task submission now resolves repeated idempotency keys to the original task when the request matches and returns a conflict for a different request. Unit tests cover this behavior.
- `src/http/dashboard.ts` adds a responsive task-control UI for token-based connection, task submission, history, checkpoints, allowed state actions, and a read-only Raza audit button; the token is held only in page memory. Dashboard delivery/CSP and audit endpoint tests pass.
- `src/audit/raza-monitor.ts` adds a read-only invariant audit of task/event/checkpoint records and exposes it through the authenticated API. This is an initial audit module, not yet a separate service or an independent check of GitHub/CI evidence.\n- `docs/QUICKSTART.md` describes runtime setup, migrations, API usage, route configuration, dashboard access, and limitations. No hosted database or deployment is provisioned.

- Authenticated HTTP API in `src/http/api-server.ts` with liveness/readiness, idempotency-keyed task submission, task listing/inspection, constrained pause/resume/cancel/approval actions, constant-time bearer-token comparison, JSON size limits, safe error responses, and a same-origin responsive dashboard with restrictive content-security policy.
- `src/http/dashboard.ts` adds token-based connection, task submission, history, checkpoint inspection, allowed state actions, and a read-only Raza audit button. The token stays in page memory rather than browser storage.
- `src/audit/raza-monitor.ts` adds a read-only invariant audit of task/event/checkpoint records and exposes it through the authenticated API. This is an initial audit module, not yet a separate service or an independent check of GitHub/CI evidence.
- PostgreSQL-backed worker supports multiple explicitly configured OpenAI-compatible routes, priority ordering, bounded fallback, and graceful shutdown. Paused/failed task resume atomically reactivates the durable queue entry.
- `docs/QUICKSTART.md` describes runtime setup, migrations, API usage, dashboard access, route configuration, and current limitations. No hosted database or deployment is provisioned.

## Verification boundary

Run #362 passed both jobs on code commit `45f9bbfd3498047d8733612e9874d663486bfb57`: `npm ci`, dependency audit threshold, typecheck, 81 unit tests, build, lint, PostgreSQL migration/schema checks, and five live PostgreSQL integration tests. This verifies the API, dashboard, worker, multi-route adapter, idempotency behavior, atomic resume/re-queue, and the read-only task-record audit endpoint. Later documentation-only commits have separate CI runs.

The tests use an ephemeral CI database, not a provisioned production database. No cloud deployment has occurred.

## Important limitations

No production database is provisioned, and there is no scheduled/automated backup process or cloud deployment. The generic HTTP adapter is implemented, but no real provider/model credentials or live model call have been configured or tested. A production application must configure its PostgreSQL pool using environment settings. A provider-reported zero cost is not independent billing proof. `docs/OPERATIONS_BACKUP_RECOVERY.md` documents the required operator procedure and readiness checklist; it does not mean backups are configured or running.

The repository-wide Prettier check was removed from CI because it failed on 45 existing baseline files, including agent profiles and docs. The `format:check` script remains available for a later controlled formatting pass; formatting is not currently a CI gate.

## Not implemented yet

- Production database provisioning and tested automated backups/disaster recovery.
- A verified live provider/model configuration and independent cost/usage reconciliation.
- Sirfaraz orchestration and specialist execution.
- Separate read-only Raza monitoring service.
- Authenticated GitHub automation, cloud deployment, mobile dashboard, and notifications.

## Latest work (2026-10-17)

- Added PostgreSQL schema migration and PostgreSQL 16 CI validation.
- Added PostgreSQL queue and TaskStore adapters, including atomic `createQueued()`.
- Wired `TaskService.submit()` to the atomic store capability, with fail-closed behavior for stores that do not support atomic submission.
- Added live PostgreSQL integration tests and a dedicated `test:postgres` CI step.
- Added an environment-driven PostgreSQL pool factory and safe, commented configuration examples.
- Added `docs/OPERATIONS_BACKUP_RECOVERY.md` covering backup exports, encryption, restore drills, recovery sequence, connection-pool sizing, cost/security stop conditions, and production-readiness checks. This is documentation only; no database or backup service was provisioned.
- Generated and committed `package-lock.json` from clean Node.js 22/npm 10.9.9, then switched both CI dependency-install steps to `npm ci`.
- Added `docs/FREE_TIER_DATABASE_EVALUATION.md` with current official-source comparison of Aiven, Neon, Supabase, and Render. Aiven and Neon remain candidates only.
- Run #231 passed both jobs, including five live PostgreSQL integration tests. No deployment was made; `main` remains unchanged and PR #2 remains a draft.

## Next actions

1. Finish CI verification for the latest documentation-only commits.
2. Choose a database only after a deliberate owner review of current limits, backups, connection budget, and the $0 policy; do not provision automatically.
3. Implement the first real provider adapter only after verifying the provider's official free-tier terms and independent cost controls.
4. Continue toward Sirfaraz orchestration and Raza's independent read-only verification role.

## Truth standard

Code written is not automatically treated as deployed or production-ready. A milestone is complete only when required checks and acceptance evidence pass.
