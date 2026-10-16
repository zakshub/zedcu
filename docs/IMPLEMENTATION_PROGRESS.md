# Implementation Progress

Updated: 2026-10-16

GitHub Actions run #185 passed both jobs on commit `986293c46f2790868d1205bf0004050293242a1f`: the runtime checks passed typecheck, all 46 unit tests, build, lint, and the high-severity dependency audit gate; the PostgreSQL 16 schema job passed migration re-application, schema checks, duplicate idempotency-key rejection, and incomplete-lease rejection.

## Implemented in this branch (latest successful CI run #185)

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
- PostgreSQL TaskStore adapter with optimistic version checks, transaction-protected task/history writes, and a `createQueued()` operation that inserts a task, its checkpoints/audit history, and queue row in one transaction.
- Tests for atomic submission success/rollback, stale optimistic versions, queue lease claims, and stale lease acknowledgement using a fake SQL client.
- GitHub Actions workflow for typecheck, tests, build, lint, high-severity dependency audit, and PostgreSQL schema/constraint checks.
- Vitest upgraded after CI identified critical dependency advisories; the high-severity audit gate passes in the latest successful run.

## Verification boundary

Run #185 is green on commit `986293c46f2790868d1205bf0004050293242a1f`: 9 test files and 46 tests passed; typecheck, build, lint, dependency audit threshold, and the PostgreSQL schema job passed.

The PostgreSQL adapter tests use a fake SQL client, not a live database connection. The PostgreSQL service job validates the migration and selected constraints, but does not yet execute the adapters against PostgreSQL. The latest documentation updates may trigger a separate CI run; the code-verification result above applies to the exact tested commit.

## Important limitations

No production database is provisioned, and there is no connection-pool configuration, backups, recovery process, cloud deployment, or real provider API integration. The application must supply a configured SQL pool to the PostgreSQL adapters. A provider-reported zero cost is not independent billing proof.

The repository-wide Prettier check was removed from CI because it failed on 45 existing baseline files, including agent profiles and docs. The `format:check` script remains available for a later controlled formatting pass; formatting is not currently a CI gate.

## Not implemented yet

- Live PostgreSQL integration tests for the adapters, concurrent submissions, concurrent claims, expired lease reclaim, and transaction rollback against the actual database.
- Database provisioning, backups, and disaster recovery.
- Real provider API adapters and independent cost/usage reconciliation.
- Sirfaraz orchestration and specialist execution.
- Separate read-only Raza monitoring service.
- Authenticated GitHub automation, cloud deployment, mobile dashboard, and notifications.
- Committed npm lockfile from a clean Node 22 environment; CI still uses `npm install`.

## Latest work (2026-10-16)

- Added `migrations/001_durable_task_queue.sql` and `docs/POSTGRES_TASK_QUEUE_DESIGN.md`.
- Added PostgreSQL 16 CI validation for repeatable migration, schema objects, unique idempotency keys, and lease ownership constraints.
- Added `src/tasks/postgres-task-queue.ts` and its tests.
- Added `src/tasks/postgres-task-store.ts`, including atomic `createQueued()`, and rollback/concurrency tests.
- Fixed the exact-optional-property type error and two lint errors identified by CI.
- Upgraded Vitest to the audit-recommended 5.0.5 line and enforced a high-severity audit threshold.
- Run #185 passed both jobs with 46 tests. No deployment was made; `main` remains unchanged and PR #2 remains a draft.

## Next actions

1. Add live PostgreSQL integration tests for adapter behavior and race conditions.
2. Generate and commit a lockfile from a clean Node 22 environment, then switch CI to `npm ci`.
3. Add a supported pool factory/configuration path with environment-based connection settings and no committed secrets.
4. Evaluate database free tiers and durability before provisioning; no paid resources without explicit approval.
5. Verify official provider terms before enabling real routes.

## Truth standard

Code written is not automatically treated as deployed or production-ready. A milestone is complete only when required checks and acceptance evidence pass.
