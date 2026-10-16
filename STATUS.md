# ZEDCU Status

**Date:** 2026-10-16  
**Repository:** `zakshub/zedcu`  
**Default branch:** `main`  
**Active implementation branch:** `feat/phase-1-runtime-baseline`  
**Pull request:** [#2 — Phase 1 runtime foundation](https://github.com/zakshub/zedcu/pull/2) (draft; not merged)

## Current baseline

GitHub Actions run #185 passed both jobs on commit `986293c46f2790868d1205bf0004050293242a1f`. The runtime checks passed typecheck, all 46 unit tests, build, lint, and the high-severity dependency audit gate. The PostgreSQL 16 schema job also passed repeat migration, schema checks, duplicate idempotency-key rejection, and incomplete-lease rejection.

A PostgreSQL queue adapter and PostgreSQL TaskStore adapter are now present. The TaskStore exposes `createQueued()`, which inserts the task, initial checkpoints/audit history, and durable queue entry in a single transaction. Adapter tests still use a fake SQL client; live PostgreSQL integration testing remains a gap.

Planning baseline and all 15 agent profiles remain on `main`. Runtime implementation remains isolated on the feature branch.

## Implemented in the feature branch

- Strict TypeScript baseline, provider contracts, gateway registry, capability-aware routing, and zero-spend route policy.
- Gateway-neutral strategy for OmniRoute, OpenRouter, direct providers, and additional candidates; no real provider network adapters are connected.
- Bounded fallback runner with attempt tracking, timeout, cooperative cancellation, and fail-closed cost handling.
- Task state machine/service, ordered audit events, checkpoints, and single-process JSON persistence with optimistic version checks.
- In-memory queue and PostgreSQL queue adapter with idempotency rules and worker leases.
- PostgreSQL TaskStore with optimistic concurrency, transaction-protected history, and atomic task + queue submission.
- Run #185 passed: 9 test files, 46 tests, typecheck, build, lint, dependency audit gate, and PostgreSQL schema/constraint job.

## Important limitations

- PostgreSQL adapter tests use a fake SQL client; adapter transactions have not yet been exercised against the live PostgreSQL CI service.
- No database is provisioned, and there are no backups, recovery process, or production connection configuration.
- No real provider API adapters, live official pricing verification, Sirfaraz orchestration, Raza monitoring service, cloud deployment, or mobile dashboard.
- Repository-wide formatting is not enforced in CI because 45 pre-existing files fail Prettier; a controlled cleanup is still needed.
- No npm lockfile is committed yet; CI uses `npm install`.
- A zero-cost app policy does not independently guarantee that an upstream provider will never bill.

## Next actions

1. Add live PostgreSQL integration tests for transaction rollback, concurrent submissions/claims, and stale lease tokens.
2. Commit a Node 22 lockfile and switch CI to `npm ci`.
3. Add a supported pool factory/configuration path without committed secrets.
4. Evaluate database free tiers and durability before choosing a host; no paid resources without explicit approval.
5. Keep PR #2 as draft and leave `main` unchanged until owner approval.

## Truth standard

Report features as planned, implemented, tested, deployed, or independently verified only when evidence supports that exact status.
