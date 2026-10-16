# ZEDCU Status

**Date:** 2026-10-16  
**Repository:** `zakshub/zedcu`  
**Default branch:** `main`  
**Active implementation branch:** `feat/phase-1-runtime-baseline`  
**Pull request:** [#2 — Phase 1 runtime foundation](https://github.com/zakshub/zedcu/pull/2) (draft; not merged)

## Current baseline

GitHub Actions run #231 passed both jobs on commit `50b22ed44c1a7601624972355cd17d9b0a928e34`. The checks job passed `npm ci`, the high-severity dependency audit gate, typecheck, 51 unit tests, build, and lint. The PostgreSQL 16 job passed migration/schema checks and four live integration tests.

The feature branch includes a PostgreSQL queue adapter, a PostgreSQL TaskStore with atomic task + queue submission, and a pool factory that reads environment configuration without logging credentials. `TaskService.submit()` uses the atomic store capability and refuses to create a task when the selected store cannot enqueue it atomically.

Planning baseline and all 15 agent profiles remain on `main`. Runtime implementation remains isolated on the feature branch. Latest commits add documentation and are undergoing their own CI runs.

## Implemented in the feature branch

- Strict TypeScript baseline, provider contracts, gateway registry, capability-aware routing, and zero-spend route policy.
- Gateway-neutral strategy for OmniRoute, OpenRouter, direct providers, and additional candidates; no real provider network adapters are connected.
- Bounded fallback runner with attempt tracking, timeout, cooperative cancellation, and fail-closed cost handling.
- Task state machine/service, ordered audit events, checkpoints, and single-process JSON persistence with optimistic version checks.
- In-memory queue and PostgreSQL queue adapter with idempotency rules and worker leases.
- PostgreSQL TaskStore with optimistic concurrency, transactional history writes, and atomic task + queue submission.
- Environment-driven PostgreSQL pool factory with input validation and optional certificate-verified SSL.
- Committed Node 22 `package-lock.json`; CI now uses `npm ci` in both application dependency-install steps. Run #231 verified both CI jobs on that code revision.
- Database backup/recovery operating runbook documented; no backup service or database has been provisioned.
- Free-tier database comparison documented. Aiven and Neon are shortlisted for a controlled prototype evaluation; no provider has been selected.
- Run #231 passed: 51 unit tests, four live PostgreSQL integration tests, typecheck, build, lint, dependency audit gate, and PostgreSQL schema checks.

## Important limitations

- CI used an ephemeral PostgreSQL service; no production database is provisioned.
- No scheduled/automated production backups, tested disaster recovery, cloud deployment, real provider API adapters, or independent cost reconciliation.
- Sirfaraz orchestration, the read-only Raza monitoring service, and mobile dashboard are not implemented.
- Repository-wide formatting is not enforced in CI because 45 pre-existing files fail Prettier; a controlled cleanup is still needed.
- A zero-cost app policy does not independently guarantee that an upstream provider will never bill.
- Current documentation commits are being checked by separate CI runs; the latest green code verification is run #231.

## Next actions

1. Complete CI verification of the latest documentation-only commits.
2. Select a database only after owner review of current limits, backups, connection budget, and the $0 policy; do not provision automatically.
3. Begin provider adapters only after official free-tier terms and independent cost controls are verified.
4. Keep PR #2 as draft and leave `main` unchanged until owner approval.

## Truth standard

Report features as planned, implemented, tested, deployed, or independently verified only when evidence supports that exact status.
