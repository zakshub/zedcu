# Implementation Progress

Updated: 2026-10-16

The feature branch now contains a PostgreSQL-backed queue adapter using a caller-supplied connection pool, plus focused tests for transactional claims and stale lease rejection. GitHub Actions run #169 reports the main checks job passing: typecheck, all 42 unit tests, build, lint, and the high-severity dependency audit threshold. The PostgreSQL schema validation job is still running, so the full workflow is not yet confirmed green.

## Implemented in this branch (verify each latest CI run)

- Strict TypeScript project baseline and npm scripts.
- Provider request/response contracts and normalized failure categories.
- Pluggable gateway registry with enable/disable metadata, protocol/capability descriptors, and duplicate-ID protection.
- Capability-aware route selection with explicit priority ordering, cooldown filtering, and required task capabilities; the free-only policy remains the hard gate.
- Gateway-neutral integration strategy covering OmniRoute, OpenRouter, direct providers, and candidate gateways such as LiteLLM, Bifrost, Portkey Gateway, New API, Agent Router / Envoy AI Gateway, Kong AI Gateway, and Cloudflare AI Gateway. Candidates are not approved or connected integrations.
- Free-route policy requiring explicit zero-cost evidence checked within 30 days.
- Bounded fallback runner with per-route attempt records, duplicate-route prevention, retryable-failure handling, per-request timeout, cooperative cancellation signal, and fail-closed rejection when zero cost is not explicitly reported.
- Guarded task-state transitions, task records, ordered audit events, a storage interface, and a single-process JSON store with atomic replacement, optimistic version checks, and restart-read tests.
- Task service for task creation, state transitions, numbered checkpoints, and audit events.
- Queue contract and in-memory test adapter for idempotent enqueue, worker leases, expiry/reclaim, acknowledgement, retry release, and attempt tracking.
- PostgreSQL schema migration for tasks, checkpoints, ordered audit events, durable idempotency keys, queue status, and lease ownership constraints.
- PostgreSQL queue adapter using a supplied SQL pool; claims use row locks with `SKIP LOCKED`, and acknowledgement/release require the current unexpired lease token.
- Unit tests for routing policy, fallback, task transitions, JSON persistence conflicts, checkpoints, queue idempotency, in-memory lease behavior, and PostgreSQL queue SQL contract.
- GitHub Actions workflow for typecheck, tests, build, lint, a high-severity dependency audit gate, and PostgreSQL migration/schema-constraint validation.
- Updated Vitest to the audit-recommended patched major version; the current CI audit threshold passes.

## Important limitations

The PostgreSQL queue adapter is not yet paired with a PostgreSQL TaskStore or an atomic task-submission service. Its `enqueue()` expects the task row to exist already; task creation, queue insertion, and the creation audit event are not yet one transaction. Adapter tests use a fake SQL client, while a PostgreSQL 16 service job checks schema/migration constraints separately.

No production database is provisioned, and there is no connection pool configuration, backups, recovery process, cloud deployment, or real provider API integration. The current CI run's PostgreSQL schema job is still pending. A provider-reported zero cost is not independent billing proof.

The repository-wide Prettier check was removed from CI because it failed on 45 existing baseline files, including agent profiles and docs. The `format:check` script remains available for a later controlled formatting pass; formatting is not currently a CI gate.

## Not implemented yet

- PostgreSQL TaskStore and atomic task + queue + audit submission transaction.
- Real PostgreSQL integration tests for concurrent claims, duplicate submissions, stale tokens, and transaction rollback.
- Database provisioning, backups, and disaster recovery.
- Real provider API adapters and independent cost/usage reconciliation.
- Sirfaraz orchestration and specialist execution.
- Separate read-only Raza monitoring service.
- Authenticated GitHub automation, cloud deployment, mobile dashboard, and notifications.
- Committed npm lockfile from a clean Node 22 environment.

## Latest work (2026-10-16)

- Added `migrations/001_durable_task_queue.sql` and `docs/POSTGRES_TASK_QUEUE_DESIGN.md`.
- Added PostgreSQL 16 CI validation for repeatable migration, schema objects, unique idempotency keys, and lease ownership constraints.
- Added `src/tasks/postgres-task-queue.ts` and `tests/postgres-task-queue.test.ts`.
- Latest observed CI run #169: main checks passed (typecheck, 42 tests, build, lint, and high-severity audit gate); PostgreSQL schema job was still in progress at the last check.
- The prior run identified three dependency advisories, including two critical Vitest-related findings. Vitest was upgraded to the audit-recommended 5.0.5 line, and the new high-severity audit gate passed in run #169.
- Local clone remains unavailable in this execution environment due to GitHub DNS resolution failure; GitHub-hosted CI is being used for verification.

## Next actions

1. Confirm PostgreSQL schema job outcome and fix any failure.
2. Add PostgreSQL TaskStore plus a single-transaction submission service.
3. Add actual PostgreSQL integration tests for atomicity and concurrent lease handling.
4. Commit a lockfile from the verified Node 22 environment and switch CI from `npm install` to `npm ci`.
5. Evaluate current free-tier database options before provisioning; no paid resources without explicit approval.
6. Verify official provider terms before enabling real routes.

## Truth standard

Code written is not automatically treated as deployed or production-ready. A milestone is complete only when required checks and acceptance evidence pass.
