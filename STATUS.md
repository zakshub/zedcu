# ZEDCU Status

**Date:** 2026-10-16  
**Repository:** `zakshub/zedcu`  
**Default branch:** `main`  
**Active implementation branch:** `feat/phase-1-runtime-baseline`  
**Pull request:** [#2 — Phase 1 runtime foundation](https://github.com/zakshub/zedcu/pull/2) (draft; not merged)

## Current baseline

GitHub Actions run #196 passed both jobs on commit `8597e9037098b2a0513f93f1b915ac36e76e3e51`. The main checks passed typecheck, 46 unit tests, build, lint, and the high-severity dependency audit gate. The PostgreSQL 16 job passed migration/schema checks and four live integration tests.

The PostgreSQL TaskStore now exposes `createQueued()`, which inserts the task, its initial checkpoints/audit history, and the durable queue entry in one transaction. Live CI tests verify persistence/reload, rollback on a history constraint failure, distinct concurrent worker claims, lease expiry/reclaim, and stale-token rejection.

Planning baseline and all 15 agent profiles remain on `main`. Runtime implementation remains isolated on the feature branch.

## Implemented in the feature branch

- Strict TypeScript baseline, provider contracts, gateway registry, capability-aware routing, and zero-spend route policy.
- Gateway-neutral strategy for OmniRoute, OpenRouter, direct providers, and additional candidates; no real provider network adapters are connected.
- Bounded fallback runner with attempt tracking, timeout, cooperative cancellation, and fail-closed cost handling.
- Task state machine/service, ordered audit events, checkpoints, and single-process JSON persistence with optimistic version checks.
- In-memory queue and PostgreSQL queue adapter with idempotency rules and worker leases.
- PostgreSQL TaskStore with optimistic concurrency, transactional history writes, and atomic task + queue submission.
- Run #196 passed: 46 unit tests, four live PostgreSQL integration tests, typecheck, build, lint, dependency audit gate, and PostgreSQL schema checks.

## Important limitations

- CI used an ephemeral PostgreSQL service; no production database is provisioned.
- No backups, recovery process, production connection configuration, or cloud deployment yet.
- No real provider API adapters, live official pricing verification, Sirfaraz orchestration, Raza monitoring service, or mobile dashboard.
- Repository-wide formatting is not enforced in CI because 45 pre-existing files fail Prettier; a controlled cleanup is still needed.
- No npm lockfile is committed yet; CI uses `npm install`.
- A zero-cost app policy does not independently guarantee that an upstream provider will never bill.

## Next actions

1. Add a supported PostgreSQL pool factory/configuration path without committed secrets.
2. Commit a Node 22 lockfile and switch CI to `npm ci`.
3. Document database backups and recovery before choosing a host.
4. Evaluate database free tiers and durability before provisioning; no paid resources without explicit approval.
5. Keep PR #2 as draft and leave `main` unchanged until owner approval.

## Truth standard

Report features as planned, implemented, tested, deployed, or independently verified only when evidence supports that exact status.
