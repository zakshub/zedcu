# Implementation Progress

Updated: 2026-10-16

GitHub Actions run #215 passed both jobs on commit `91e58658ec5232613cc6642ec145df1164f4ca1c`. The runtime checks passed typecheck, all 51 unit tests, build, lint, and the high-severity dependency audit gate. The PostgreSQL 16 service job passed migration/schema checks and four live integration tests. Documentation-only run #218 also passed both jobs. A temporary Node 22 bootstrap run successfully generated the lockfile and passed npm ci, typecheck, 51 unit tests, build, and lint; the temporary workflow was removed afterward.

## Implemented in this branch (code verified by run #215 unless noted)

- Strict TypeScript project baseline and npm scripts.
- Provider request/response contracts and normalized failure categories.
- Pluggable gateway registry with enable/disable metadata, protocol/capability descriptors, and duplicate-ID protection.
- Capability-aware route selection with explicit priority ordering, cooldown filtering, and required task capabilities; the free-only policy remains the hard gate.
- Gateway-neutral integration strategy covering OmniRoute, OpenRouter, direct providers, and candidate gateways such as LiteLLM, Bifrost, Portkey Gateway, New API, Agent Router / Envoy AI Gateway, Kong AI Gateway, and Cloudflare AI Gateway. Candidates are not approved or connected integrations.
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
- Committed `package-lock.json` generated with Node.js 22/npm 10.9.9. The temporary bootstrap workflow passed `npm ci`, typecheck, 51 unit tests, build, and lint before committing the lockfile.
- CI dependency installation updated to `npm ci` in both the regular and PostgreSQL integration jobs. The updated CI run is pending verification.
- Vitest upgraded after CI identified critical dependency advisories; the high-severity audit gate passes.

## Verification boundary

Run #215 is green on commit `91e58658ec5232613cc6642ec145df1164f4ca1c`: 10 unit-test files and 51 unit tests passed; typecheck, build, lint, dependency audit threshold, PostgreSQL migration checks, and four live PostgreSQL integration tests passed. Documentation-only run #218 also passed both jobs. The lockfile bootstrap workflow separately passed clean `npm ci`, typecheck, all 51 unit tests, build, and lint.

The tests use an ephemeral CI database, not a provisioned production database. No cloud deployment has occurred. The follow-up CI run is required to verify the committed lockfile and updated `npm ci` workflow together.

## Important limitations

No production database is provisioned, and there is no scheduled/automated backup process, cloud deployment, or real provider API integration. A production application must configure its PostgreSQL pool using environment settings. A provider-reported zero cost is not independent billing proof. `docs/OPERATIONS_BACKUP_RECOVERY.md` documents the required operator procedure and readiness checklist; it does not mean backups are configured or running.

The repository-wide Prettier check was removed from CI because it failed on 45 existing baseline files, including agent profiles and docs. The `format:check` script remains available for a later controlled formatting pass; formatting is not currently a CI gate.

## Not implemented yet

- Production database provisioning and tested automated backups/disaster recovery.
- Real provider API adapters and independent cost/usage reconciliation.
- Sirfaraz orchestration and specialist execution.
- Separate read-only Raza monitoring service.
- Authenticated GitHub automation, cloud deployment, mobile dashboard, and notifications.

## Latest work (2026-10-16)

- Added PostgreSQL schema migration and PostgreSQL 16 CI validation.
- Added PostgreSQL queue and TaskStore adapters, including atomic `createQueued()`.
- Wired `TaskService.submit()` to the atomic store capability, with fail-closed behavior for stores that do not support atomic submission.
- Added live PostgreSQL integration tests and a dedicated `test:postgres` CI step.
- Added an environment-driven PostgreSQL pool factory and safe, commented configuration examples.
- Added `docs/OPERATIONS_BACKUP_RECOVERY.md` covering backup exports, encryption, restore drills, recovery sequence, connection-pool sizing, cost/security stop conditions, and production-readiness checks. This is documentation only; no database or backup service was provisioned.
- Generated and committed `package-lock.json` from clean Node.js 22/npm 10.9.9, verified clean `npm ci` plus typecheck, 51 unit tests, build, and lint, then removed the temporary bootstrap workflow.
- Changed CI's two dependency-install steps from `npm install` to `npm ci`; final verification of this exact CI revision is pending.
- No deployment was made; `main` remains unchanged and PR #2 remains a draft.

## Next actions

1. Confirm the new CI run passes using the committed lockfile and `npm ci`.
2. Evaluate free-tier database options and durability before provisioning; no paid resources without explicit approval.
3. Begin provider adapters only after independently verifying official free-tier terms and cost boundaries.
4. Configure backup automation and complete a restore drill only after a database host is selected and explicitly approved.

## Truth standard

Code written is not automatically treated as deployed or production-ready. A milestone is complete only when required checks and acceptance evidence pass.
