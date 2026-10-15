# ZEDCU Status

**Date:** 2026-10-15  
**Repository:** `zakshub/zedcu`  
**Default branch:** `main`  
**Active implementation branch:** `feat/phase-1-runtime-baseline`  
**Pull request:** [#2 — Phase 1 runtime foundation](https://github.com/zakshub/zedcu/pull/2) (draft; not merged)

## Current baseline

The planning baseline and 15 agent profiles remain on `main`. Implementation is happening on a separate feature branch. The latest confirmed CI run passed typecheck, tests, build, and lint on the gateway-registry implementation (workflow run #95).

## Implemented in the feature branch

- Strict TypeScript project configuration and npm scripts.
- Provider adapter contracts and normalized failure categories.
- Pluggable gateway registry and route-level gateway identity, separated from upstream provider/model identity; gateway registry and cross-gateway routing tests pass CI.
- Gateway-neutral strategy document that treats OmniRoute, OpenRouter, direct providers, and additional compatible gateways as independently evaluated options.
- Free-route policy that rejects paid/unknown routes and requires explicit zero-cost pricing evidence checked within 30 days.
- Bounded alternate-route attempts with per-run attempt records, retryable-failure handling, duplicate-route prevention, and a safe pause when no eligible route remains.
- Task state machine and service for creation, guarded transitions, checkpoints, and ordered audit events.
- Single-process JSON task store with atomic file replacement, optimistic version checks, and restart-read tests.
- Unit tests for route policy, fallback, task transitions, persistence conflicts, and checkpoint/audit behavior.
- GitHub Actions workflow for typecheck, tests, build, and lint.
- Safe environment template without credentials.

## Important limitations

- The JSON store is only a single-process development baseline; it is not safe for multiple cloud workers and is not production database durability.
- Checkpoints save summaries and artifact paths; they do not snapshot or restore a workspace.
- No lockfile is committed yet.
- Provider evidence is metadata supplied to the policy, not an independent live pricing verification. No real provider API is wired.
- A provider-reported zero cost is not independent billing proof.

## Not yet implemented

- Transactional database, migrations, backup/restore, queue, worker leases, idempotency, and restart recovery of active work.
- Real provider API adapters and independent usage/cost reconciliation.
- Sirfaraz orchestration and specialist execution.
- Separate read-only Raza monitoring service.
- Authenticated GitHub automation from a running application.
- Cloud deployment, persistent hosting, mobile dashboard, and notifications.
- Verification that the system operates while personal devices are offline.

## Next actions

1. Confirm CI on the latest branch commit, including gateway registry tests.
2. Generate and commit a lockfile from a clean Node 22 environment.
3. Select persistence and queue services only after validating current free-tier limits and reliability.
4. Implement worker leases, idempotency, cancellation, and verified checkpoint recovery.
5. Verify official provider pricing and terms before enabling real routes.

## Truth standard

Report each feature as planned, implemented, tested, deployed, or independently verified. Code written is not automatically production-ready. Do not describe the system as deployed or autonomous.
