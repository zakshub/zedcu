# Implementation Progress

Updated: 2026-10-16

GitHub Actions run #205 passed both jobs on commit `0ecbaa215e56a63f395585d6ec12516f013d05a5`. The runtime checks passed typecheck, all 50 unit tests, build, lint, and the high-severity dependency audit gate. The PostgreSQL 16 service job passed migration/schema checks and four live integration tests against PostgreSQL.

## Implemented in this branch (verified by run #205)

- Strict TypeScript project baseline and npm scripts.
- Provider request/response contracts and normalized failure categories.
- Pluggable gateway registry with enable/disable metadata, protocol/capability descriptors, and duplicate-ID protection.
- Capability-aware route selection with explicit priority ordering, cooldown filtering, and required task capabilities; the free-only policy remains the hard gate.
- Gateway-neutral integration strategy covering OmniRoute, OpenRouter, direct providers, and candidate gateways such as LiteLLM, Bifrost, Portkey Gateway, New API, Agent Router / Envoy AI Gateway, Kong AI Gateway, and Cloudflare AI Gateway. Candidates are not approved or connected integrations.
- Free-route policy requiring explicit zero-cost evidence checked within 30 days.
- Bounded fallback runner with per-route attempt records, duplicate-route prevention, retryable-failure handling, per-request timeout, cooperative cancellation signal, and fail-closed rejection when zero cost is not explicitly reported.
- Guarded task-state transitions, task records, ordered audit events, a storage interface, and a single-process JSON store with atomic replacement, optimistic version checks, and restart-read tests.
- Task service for task creation, state transitions, numbered checkpoints, and audit events.
- In-memory queue adapter for development/tests and PostgreSQL queue adapter with row-lock claims using `SKIP LOCKED`, lease expiry/reclaim, acknowledgement, and retry release.
- PostgreSQL schema migration for tasks, checkpoints, ordered audit events, durable idempotency keys, queue status, and lease ownership constraints.
- PostgreSQL TaskStore adapter with optimistic version checks, transaction-protected task/history writes, and `createQueued()` that inserts the task, checkpoints, audit history, and queue row in one transaction.
- PostgreSQL pool factory resolving `DATABASE_URL` or `PGHOST`/`PGPORT`/`PGDATABASE`/`PGUSER`/`PGPASSWORD`, with validated pool limits and optional certificate-verified SSL. No secrets are logged or committed.
- Live PostgreSQL integration tests for task persistence/reload, transaction rollback, concurrent worker claims, expired lease reclaim, and stale-token rejection.
- Pool configuration unit tests for missing settings, SSL, connection URL, and invalid numeric values.
- GitHub Actions workflow for typecheck, tests, build, lint, high-severity dependency audit, migration validation, and live PostgreSQL integration testing.
- Vitest upgraded after CI identified critical dependency advisories; the high-severity audit gate passes.

## Verification boundary

Run #205 is green on commit `0ecbaa215e56a63f395585d6ec12516f013d05a5`: 10 unit-test files and 50 unit tests passed; typecheck, build, lint, dependency audit threshold, PostgreSQL migration checks, and four live PostgreSQL integration tests passed.

The tests use an ephemeral CI database, not a provisioned production database. No cloud deployment has occurred. Documentation updates may trigger a separate CI run; the verification above applies to the exact tested code commit.

## Important limitations

No production database is provisioned, and there is no backup/recovery process, cloud deployment, or real provider API integration. The application must create a pool through the factory or supply a compatible configured SQL pool. A provider-reported zero cost is not independent billing proof.

The repository-wide Prettier check was removed from CI because it failed on 45 existing baseline files, including agent profiles and docs. The `format:check` script remains available for a later controlled formatting pass; formatting is not currently a CI gate.

## Not implemented yet

- Production database provisioning, backups, and disaster recovery.
- Real provider API adapters and independent cost/usage reconciliation.
- Sirfaraz orchestration and specialist execution.
- Separate read-only Raza monitoring service.
- Authenticated GitHub automation, cloud deployment, mobile dashboard, and notifications.
- Committed npm lockfile from a clean Node 22 environment; CI still uses `npm install`.

## Latest work (2026-10-16)

- Added `migrations/001_durable_task_queue.sql` and `docs/POSTGRES_TASK_QUEUE_DESIGN.md`.
- Added PostgreSQL 16 CI validation for repeatable migration, schema objects, unique idempotency keys, and lease ownership constraints.
- Added PostgreSQL queue and TaskStore adapters, including atomic `createQueued()`.
- Added live PostgreSQL integration tests and a dedicated `test:postgres` CI step.
- Added an environment-driven PostgreSQL pool factory and safe, commented configuration examples.
- Fixed TypeScript and lint errors found during CI iteration.
- Upgraded Vitest to the audit-recommended 5.0.5 line and enforced a high-severity audit threshold.
- Run #205 passed both jobs: 50 unit tests and four live PostgreSQL integration tests. No deployment was made; `main` remains unchanged and PR #2 remains a draft.

## Next actions

1. Generate and commit a lockfile from a clean Node 22 environment, then switch CI to `npm ci`.
2. Add database backup, recovery, connection-limit, and operational runbooks before choosing a host.
3. Evaluate free-tier database options and durability before provisioning; no paid resources without explicit approval.
4. Begin provider adapters only after independently verifying official free-tier terms and cost boundaries.

## Truth standard

Code written is not automatically treated as deployed or production-ready. A milestone is complete only when required checks and acceptance evidence pass.
