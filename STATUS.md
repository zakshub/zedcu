# ZEDCU Status

**Date:** 2026-10-16  
**Repository:** `zakshub/zedcu`  
**Default branch:** `main`  
**Active implementation branch:** `feat/phase-1-runtime-baseline`  
**Pull request:** [#2 — Phase 1 runtime foundation](https://github.com/zakshub/zedcu/pull/2) (draft; not merged)

## Current baseline

A PostgreSQL queue adapter and focused contract tests have been added on the feature branch. In GitHub Actions run #169, the main checks job passed: TypeScript typecheck, all 42 unit tests, build, lint, and the high-severity dependency audit threshold. The PostgreSQL schema validation job was still in progress at the last check; full workflow success is not yet confirmed.

Planning baseline and all 15 agent profiles remain on `main`. Runtime implementation remains isolated on the feature branch.

## Implemented in the feature branch

- Strict TypeScript baseline, provider contracts, gateway registry, capability-aware routing, and zero-spend route policy.
- Gateway-neutral strategy for OmniRoute, OpenRouter, direct providers, and additional candidates; no real network adapters are connected.
- Bounded fallback runner with attempt tracking, timeout, cooperative cancellation, and fail-closed cost handling.
- Task state machine/service, ordered audit events, checkpoints, and single-process JSON persistence with optimistic version checks.
- In-memory queue adapter and PostgreSQL queue adapter with idempotency checks, leases, expired-lease reclamation, acknowledgement, and retry release.
- PostgreSQL schema proposal and transaction/lease design; no database is provisioned and no PostgreSQL TaskStore exists yet.
- CI main checks passed on run #169: typecheck, 42 tests, build, lint, and high-severity audit gate. PostgreSQL schema validation was still running.
- Vitest upgraded after CI found critical dependency advisories; the updated audit gate passed.

## Important limitations

- PostgreSQL queue adapter tests currently use a fake SQL client; live PostgreSQL CI checks the schema and constraints, not yet all adapter transaction behavior.
- Task creation, queue insertion, and initial audit event are not yet atomic in runtime code.
- No production database, backups, cloud deployment, real provider adapters, Sirfaraz orchestration, Raza monitoring service, or mobile dashboard.
- Repository-wide formatting is not enforced in CI because 45 pre-existing files fail Prettier; a controlled cleanup is still needed.
- A zero-cost app policy does not independently guarantee that an upstream provider will never bill.

## Next actions

1. Confirm the PostgreSQL CI job and fix any failures.
2. Implement PostgreSQL TaskStore and atomic task submission.
3. Add PostgreSQL integration tests for rollback, duplicate submission, concurrent claims, and stale lease tokens.
4. Commit a Node 22 lockfile and switch CI to `npm ci`.
5. Evaluate database free tiers and durability before choosing a host; no paid resources without explicit approval.
6. Keep PR #2 as draft and leave `main` unchanged until owner approval.

## Truth standard

Report features as planned, implemented, tested, deployed, or independently verified only when evidence supports that exact status.
