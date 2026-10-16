# ZEDCU Status

**Date:** 2026-10-16  
**Repository:** `zakshub/zedcu`  
**Default branch:** `main`  
**Active implementation branch:** `feat/phase-1-runtime-baseline`  
**Pull request:** [#2 — Phase 1 runtime foundation](https://github.com/zakshub/zedcu/pull/2) (draft; not merged)

## Current baseline

GitHub Actions run #215 passed both jobs on commit `91e58658ec5232613cc6642ec145df1164f4ca1c`. The main checks passed typecheck, 51 unit tests, build, lint, and the high-severity dependency audit gate. The PostgreSQL 16 job passed migration/schema checks and four live integration tests.

The feature branch includes a PostgreSQL queue adapter, a PostgreSQL TaskStore with atomic task + queue submission, and a pool factory that reads environment configuration without logging credentials. `TaskService.submit()` uses the atomic store capability and refuses to create a task when the selected store cannot enqueue it atomically.

Planning baseline and all 15 agent profiles remain on `main`. Runtime implementation remains isolated on the feature branch.

## Implemented in the feature branch

- Strict TypeScript baseline, provider contracts, gateway registry, capability-aware routing, and zero-spend route policy.
- Gateway-neutral strategy for OmniRoute, OpenRouter, direct providers, and additional candidates; no real provider network adapters are connected.
- Bounded fallback runner with attempt tracking, timeout, cooperative cancellation, and fail-closed cost handling.
- Task state machine/service, ordered audit events, checkpoints, and single-process JSON persistence with optimistic version checks.
- In-memory queue and PostgreSQL queue adapter with idempotency rules and worker leases.
- PostgreSQL TaskStore with optimistic concurrency, transactional history writes, and atomic task + queue submission.
- Environment-driven PostgreSQL pool factory with input validation and optional certificate-verified SSL.
- Run #215 passed: 51 unit tests, four live PostgreSQL integration tests, typecheck, build, lint, dependency audit gate, and PostgreSQL schema checks.

## Important limitations

- CI used an ephemeral PostgreSQL service; no production database is provisioned.
- No production backups/recovery process, cloud deployment, real provider API adapters, or independent cost reconciliation.
- Sirfaraz orchestration, the read-only Raza monitoring service, and mobile dashboard are not implemented.
- Repository-wide formatting is not enforced in CI because 45 pre-existing files fail Prettier; a controlled cleanup is still needed.
- No npm lockfile is committed yet; CI uses `npm install`.
- A zero-cost app policy does not independently guarantee that an upstream provider will never bill.

## Next actions

1. Commit a Node 22 lockfile and switch CI to `npm ci`.
2. Document backup/recovery and database operations before choosing a host.
3. Evaluate database free tiers and durability before provisioning; no paid resources without explicit approval.
4. Begin provider adapters only after official free-tier terms are independently verified.
5. Keep PR #2 as draft and leave `main` unchanged until owner approval.

## Truth standard

Report features as planned, implemented, tested, deployed, or independently verified only when evidence supports that exact status.
