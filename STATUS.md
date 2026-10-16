# ZEDCU Status

**Date:** 2026-10-16  
**Repository:** `zakshub/zedcu`  
**Default branch:** `main`  
**Active implementation branch:** `feat/phase-1-runtime-baseline`  
**Pull request:** [#2 — Phase 1 runtime foundation](https://github.com/zakshub/zedcu/pull/2) (draft; not merged)

## Current baseline

Work is continuing on the feature branch. The queue test suite has deterministic timestamps and a regression test rejecting release after lease expiry. A PostgreSQL schema foundation and a transaction/lease design note were added for durable tasks, checkpoints, audit events, idempotency keys, and worker leases. CI now has a PostgreSQL 16 service job that applies the migration twice and checks the resulting schema.

**Verification limitation:** the GitHub connector has not returned a workflow run or combined status for the latest commit, so the new schema job is configured but not yet confirmed passing. The local environment could not clone GitHub due to DNS resolution failure. Do not treat the newest queue/schema changes as tested or production-ready until CI succeeds.

Planning baseline and all 15 agent profiles remain on `main`. Runtime implementation remains isolated on the feature branch.

## Implemented in the feature branch

- Strict TypeScript baseline, provider contracts, gateway registry, capability-aware routing, and zero-spend route policy.
- Gateway-neutral strategy for OmniRoute, OpenRouter, direct providers, and additional candidates; no real network adapters are connected.
- Bounded fallback runner with attempt tracking, timeout, cooperative cancellation, and fail-closed cost handling.
- Task state machine/service, ordered audit events, checkpoints, and single-process JSON persistence with optimistic version checks.
- Queue interface plus an in-memory contract/test adapter for idempotent enqueue, worker leases, expiry/reclaim, acknowledgement, retry release, and attempt counts.
- PostgreSQL schema proposal and transaction/lease design; no database adapter or provisioned database yet.
- Unit tests and GitHub Actions checks for typecheck, tests, build, lint, formatting, dependency audit summary, and PostgreSQL migration/idempotency validation; newest results pending.

## Important limitations

- The JSON store and in-memory queue are not safe production infrastructure for multiple cloud workers; queue state is lost on process restart.
- The SQL migration has not yet been applied to a real PostgreSQL instance or validated by a passing CI run.
- Task and queue creation are not yet one atomic transaction in runtime code.
- Checkpoints store summaries and artifact paths, not workspace snapshots.
- No real provider API adapters, live official pricing verification, Sirfaraz orchestration, Raza monitoring service, cloud deployment, or mobile dashboard.
- A zero-cost app policy does not independently guarantee that an upstream provider will never bill.

## Next actions

1. Verify the latest GitHub Actions run and fix any failures.
2. Generate and commit a lockfile using a clean Node 22 environment.
3. Validate the migration and implement transactional PostgreSQL storage with concurrency/crash-recovery tests.
4. Evaluate database free tiers and durability before choosing a host; no paid resources without explicit approval.
5. Keep PR #2 as draft and leave `main` unchanged until owner approval.

## Truth standard

Report features as planned, implemented, tested, deployed, or independently verified only when evidence supports that exact status.
