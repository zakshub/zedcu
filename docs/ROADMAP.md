# ZEDCU Roadmap

The direction remains: a persistent cloud-hosted AI agent team, commanded through Sirfaraz, monitored independently, usable from mobile, with GitHub as the durable project record and a hard USD $0 spending rule.

## Stage 0 — Project truth and governance
- [x] Verify repository identity and default branch.
- [x] Establish project direction, architecture, roster, cost policy, security baseline, decisions, and status.
- [x] Add CI and validate the repository (latest code run #291 passed both jobs).
- [ ] Recover old local work if it is later found; never claim this baseline recovered it.

## Stage 1 — Reliable free-only model routing
- [x] Implement provider adapter interface and a generic OpenAI-compatible HTTP adapter (a real provider/model has not yet been configured or called).
- [x] Add gateway registry and generic OpenAI-compatible adapter/configuration; worker supports multiple explicitly configured gateway/model routes (no route is live until credentials and official free terms are verified).
- [x] Add capability-aware route selection, priority ranking, and cooldown filtering (live health/quota feeds remain pending).
- [x] Document a vendor-neutral gateway strategy and candidate integrations (candidates are not yet approved or connected).
- [ ] Verify free-route eligibility from current official provider evidence.
- [x] Implement policy gate that rejects unknown or paid routes before adapter invocation (official evidence verification and live routing remain pending).
- [x] Track attempted routes within a bounded fallback run (durable per-task attempt ledger remains pending).
- [x] Define normalized failure categories for quota, rate-limit, auth, timeout, and transient failures.
- [ ] Add bounded retry/backoff and cancellation (bounded alternate-route attempts exist; backoff and cancellation wiring remain pending).
- [ ] Record token usage and cost evidence; pause on ambiguity.
- [x] Add unit tests for free-route policy, fallback, task state, persistence, and checkpoint behavior (expand coverage as integration grows).

## Stage 2 — Durable task engine
- [ ] Define complete task/event/checkpoint/approval/artifact schemas (task, audit-event, and checkpoint record foundations exist; approval/artifact schemas remain pending).
- [ ] Choose and provision a persistent database only after explicit owner approval (Aiven and Neon are shortlisted; no hosted database selected or provisioned).
- [x] Implement PostgreSQL worker leases, atomic submission, idempotency, task checkpoints, and queue recovery semantics (verified in ephemeral PostgreSQL CI; production recovery drills remain pending).
- [x] Implement validated task state transitions, including planning, dispatch, queued, running, paused, waiting-approval, failed, completed, and cancelled.
- [ ] Add safe cancellation and task timeouts.

## Stage 3 — Sirfaraz and specialist agents
- [ ] Implement Sirfaraz as the sole normal command interface (HTTP task API exists; natural-language orchestration is still pending).
- [ ] Build specialist contracts and scoped permissions.
- [ ] Implement approval gates for sensitive actions.
- [ ] Add the 15-agent roster and profile files.
- [ ] Ensure every task has acceptance criteria and expected artifacts.

## Stage 4 — Independent monitoring and audit
- [ ] Build Progress Monitor as a separate read-only service/role.
- [ ] Verify file diffs, commits, test exit codes, and runtime evidence.
- [ ] Detect mismatch between reported and observed status.
- [ ] Report discrepancies directly to Zak.
- [ ] Add append-only task events and notifications.

## Stage 5 — GitHub integration and engineering quality
- [ ] Implement authenticated GitHub issue/branch/commit/report operations.
- [ ] Add CI: typecheck, build, tests, secret scan, dependency review.
- [ ] Verify every push by fetching remote commit SHA and changed paths.
- [x] Document database backup, recovery, and connection-pool operating procedures (runbook only; no live backup process is configured).
- [x] Commit Node 22 npm lockfile and use `npm ci`; latest code run #291 passed both CI jobs.

## Stage 6 — Cloud hosting
- [x] Compare current free-tier options, limits, sleep behavior, and storage durability (evaluation documented; no provider selected).
- [ ] Select hosting only after validating queue/database support and security.
- [ ] Deploy worker and API with health checks, logs, backups, and rollback.
- [ ] Ensure operation continues when Zak's laptop and phone are off.
- [ ] No deployment before explicit approval.

## Stage 7 — Mobile-friendly control dashboard
- [x] Basic task submission and task history (responsive starter dashboard; advanced filtering remains pending).
- [ ] Live status, detailed logs, artifacts, diffs, test results, and provider attempts (current dashboard shows saved task state and latest checkpoint).
- [ ] Approval inbox for gated actions (basic approval action endpoint exists, but approval workflow/policy remains pending).
- [x] Basic pause/resume/cancel actions for valid task states (retry UX and end-to-end worker control remain pending).
- [ ] Spend/usage visibility and clear $0-policy stop messages.
- [x] Responsive layout and basic status feedback.\n- [ ] Production-grade secure login, user accounts, role-based permissions, and accessible full-state feedback.

## Release criteria

A milestone is complete only when acceptance criteria pass and the Progress Monitor can cite evidence. Documentation alone is not implementation. A successful code-generation message is not proof of a saved file. A GitHub push is not proof the app is deployed.

## Global stop conditions

- No eligible free model route.
- Unknown or non-zero cost.
- Secret exposure or permission anomaly.
- Failed required tests.
- Missing checkpoint before a risky operation.
- Deployment without owner approval.

On any stop condition: preserve evidence, pause, report the blocker, and do not spend money.
