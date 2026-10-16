# ZEDCU Status

**Date:** 2026-10-15  
**Repository:** `zakshub/zedcu`  
**Default branch:** `main`  
**Active implementation branch:** `feat/phase-1-runtime-baseline`  
**Pull request:** [#2 — Phase 1 runtime foundation](https://github.com/zakshub/zedcu/pull/2) (draft; not merged)

## Current baseline

**Work resumed:** 2026-10-16. OmniRoute-based external audit is intentionally deferred. The queue test suite was made deterministic by passing explicit test timestamps to lease acknowledgement/release checks, and a regression test was added to reject release after lease expiry. These changes are committed on this feature branch; CI evidence for the newest commit is still pending and the changes are not yet marked verified.


Planning baseline and all 15 agent profiles remain on `main`. Runtime implementation remains isolated on the feature branch. CI status must be checked against the latest commit before calling this slice verified.

## Implemented in the feature branch

- Strict TypeScript baseline, provider contracts, gateway registry, capability-aware routing, and zero-spend route policy.
- Gateway-neutral strategy for OmniRoute, OpenRouter, direct providers, and additional candidates; no real network adapters are connected.
- Bounded fallback runner with attempt tracking, timeout, cooperative cancellation, and fail-closed cost handling.
- Task state machine/service, ordered audit events, checkpoints, and single-process JSON persistence with optimistic version checks.
- Queue interface plus an in-memory contract/test adapter for idempotent enqueue, worker leases, expiry/reclaim, acknowledgement, retry release, and attempt counts.
- Unit tests and GitHub Actions checks for typecheck, tests, build, and lint.

## Important limitations

- The JSON store and in-memory queue are not safe production infrastructure for multiple cloud workers; queue state is lost on process restart.
- Task and queue creation are not one atomic transaction; idempotency records are not durable.
- Checkpoints store summaries and artifact paths, not workspace snapshots.
- No real provider API adapters, live official pricing verification, Sirfaraz orchestration, Raza monitoring service, cloud deployment, or mobile dashboard.
- A zero-cost app policy does not independently guarantee that an upstream provider will never bill.

## Next actions

1. Verify CI on the latest branch commit.
2. Generate and commit a lockfile using a clean Node 22 environment.
3. Evaluate database/queue free tiers and durability before choosing a production adapter.
4. Implement durable queue/idempotency transactions and crash-recovery integration tests.
5. Keep PR #2 as draft and leave `main` unchanged until owner approval.

## Truth standard

Report features as planned, implemented, tested, deployed, or independently verified only when evidence supports that exact status.
