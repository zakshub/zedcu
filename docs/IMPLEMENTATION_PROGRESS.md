# Implementation Progress

Updated: 2026-10-16

The feature branch includes a queue contract and in-memory test adapter. A PostgreSQL schema foundation has now been added for durable tasks, checkpoints, ordered audit events, idempotency keys, and worker leases. The schema is not a connected database adapter and is not yet runtime-tested.

## Implemented in this branch (verify CI on latest commit)

- Strict TypeScript project baseline and npm scripts.
- Provider request/response contracts and normalized failure categories.
- Pluggable gateway registry with enable/disable metadata, protocol/capability descriptors, and duplicate-ID protection.
- Capability-aware route selection with explicit priority ordering, cooldown filtering, and required task capabilities; the free-only policy remains the hard gate.
- Gateway-neutral integration strategy covering OmniRoute, OpenRouter, direct providers, and candidate gateways such as LiteLLM, Bifrost, Portkey Gateway, New API, Agent Router / Envoy AI Gateway, Kong AI Gateway, and Cloudflare AI Gateway. Candidates are not approved or connected integrations.
- Free-route policy requiring explicit zero-cost evidence checked within 30 days.
- Bounded fallback runner with per-route attempt records, duplicate-route prevention, retryable-failure handling, per-request timeout, cooperative cancellation signal, and fail-closed rejection when zero cost is not explicitly reported.
- Guarded task-state transitions, task records, ordered audit events, a storage interface, and a single-process JSON store with atomic replacement, optimistic version checks, and restart-read tests.
- Task service for task creation, state transitions, numbered checkpoints, and audit events.
- Queue contract with idempotency-key conflict rules, bounded worker leases, expired-lease reclaim, acknowledgement, retry release, and attempt tracking; currently backed only by an in-memory test adapter.
- PostgreSQL schema migration for tasks, checkpoints, ordered audit events, durable idempotency keys, queue status, and lease ownership constraints.
- PostgreSQL transaction/lease design with required atomic create, claim, acknowledge/release, optimistic concurrency, and crash-recovery acceptance tests.
- Unit tests for routing policy, fallback, task transitions, persistence conflicts, checkpoints, queue idempotency, and lease behavior.
- GitHub Actions workflow for typecheck, tests, build, lint, format check, and a dependency audit summary; safe environment-variable example without credentials.

## Important limitations

The JSON task store and in-memory queue are development/test adapters. The new SQL migration is only a schema foundation: no PostgreSQL adapter, provisioned database, connection pooling, backups, or recovery process exists yet. The schema has not been applied to a live database or verified by a PostgreSQL parser in this environment.

Task checkpoints currently store summaries and artifact paths, not workspace snapshots or automated restore instructions. Provider route eligibility relies on supplied evidence metadata; no live provider adapters or official pricing verification are wired. A provider-reported zero cost is not independent billing proof.

## Not implemented yet

- PostgreSQL task-store and queue adapters with transaction-level tests.
- Database provisioning, backups, and disaster recovery.
- Durable task+queue creation and idempotency in runtime code.
- Real provider API adapters and independent cost/usage reconciliation.
- Sirfaraz orchestration and specialist execution.
- Separate read-only Raza monitoring service.
- Authenticated GitHub automation, cloud deployment, mobile dashboard, and notifications.
- Committed npm lockfile from a clean Node 22 environment.

## Latest work (2026-10-16)

- Deferred the external OmniRoute audit at the owner's direction; implementation continues using repository code and GitHub CI evidence.
- Fixed queue test nondeterminism by passing explicit timestamps to acknowledgement/release operations.
- Added a regression test proving an expired lease cannot be released.
- Added `migrations/001_durable_task_queue.sql` and `docs/POSTGRES_TASK_QUEUE_DESIGN.md`.
- CI run/status lookup for the newest commits returned no runs/statuses. The schema and queue changes remain unverified; no tests are claimed as passing on the latest commit.
- Local cloning/testing remains unavailable in this execution environment due to GitHub DNS resolution failure.

## Next actions

1. Confirm CI on the latest branch commit and fix failures.
2. Obtain a clean Node 22 environment to generate a lockfile and run formatting/typecheck/tests/build/lint.
3. Validate the migration against PostgreSQL and add integration tests for transaction atomicity, duplicate submissions, lease reclaim, and stale tokens.
4. Implement the PostgreSQL task store and queue adapter only after testable connection/configuration is available.
5. Compare database/queue candidates against current free-tier limits and durability before selecting a host; no paid resource without explicit approval.
6. Verify official provider terms before enabling real routes.

## Truth standard

Code written is not automatically treated as deployed or production-ready. A milestone is complete only when required checks and acceptance evidence pass.
