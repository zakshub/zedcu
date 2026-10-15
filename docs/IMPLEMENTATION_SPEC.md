# ZEDCU Implementation Specification

This document converts the agreed direction into an implementation order. It does not claim any runtime components already exist.

## Product acceptance target

Zak can submit a task from a mobile-friendly dashboard; Sirfaraz plans and dispatches it; specialist workers execute scoped work in a persistent cloud workspace; the system checkpoints progress; Raza independently verifies artifacts and test evidence; and Zak can inspect logs, diffs, approvals, and final results while personal devices are offline.

The entire workflow must enforce a hard USD $0 spend ceiling. If no eligible free model is available, it must pause safely.

## Phase 1 — Repository and engineering baseline

Deliverables:
- A minimal, maintained project structure.
- TypeScript strict mode or another selected language standard documented in an ADR.
- Formatting, lint, typecheck, build, and test commands.
- CI that runs checks on pull requests and main-branch commits.
- Secret scanning and .gitignore protections.
- .env.example containing names and safe placeholders only, never credentials.

Acceptance:
- Fresh clone can install and run documented checks.
- CI passes on a clean commit.
- No credentials or paid provider configuration are required to run tests.
- README clearly distinguishes implemented features from planned features.

## Phase 2 — Free-only provider routing

Deliverables:
- Provider adapter interface and normalized response/error types.
- Route registry with explicit allowlist and pricing evidence metadata.
- Policy gate that rejects paid or unknown routes before network access.
- Per-task attempted-route ledger.
- Failure classifier and bounded retry/backoff.
- Cancellation and request timeout support.
- Usage/cost evidence stored for each attempt.
- Mock-provider tests that run without external API calls.

Acceptance tests:
- Paid or unknown route is denied before network request.
- Zero eligible routes yields a paused task with a useful reason.
- A failed route is not retried endlessly.
- Rate limit can select a different eligible route or pause safely.
- Quota exhaustion never triggers a paid fallback.
- Missing/ambiguous cost evidence prevents a task from being marked successful.
- API keys never appear in logs or test snapshots.

Important: verify current official pricing, model IDs, quotas, and terms at implementation time. Do not hardcode model IDs copied from old chats as if their availability were guaranteed.

## Phase 3 — Durable task engine

Deliverables:
- Database schema for tasks, events, attempts, checkpoints, artifacts, approvals, and verification runs.
- Queue worker with leases, idempotency, bounded retries, and cancellation.
- Checkpoint and restart-recovery behavior.
- Task state transition rules.
- Migration and backup/restore documentation.

Acceptance:
- Restarting the worker does not lose task history.
- A duplicate queue delivery does not repeat a completed side effect.
- A paused task resumes from its latest verified checkpoint.
- Cancelled tasks stop at a safe boundary.
- State transitions are validated and auditable.

Database and queue choices must be based on verified current free-tier terms, durability, and security. Do not select a service merely because a marketing page says “free.”

## Phase 4 — Sirfaraz and specialist execution

Deliverables:
- Sirfaraz command parser/planner and task dispatcher.
- Versioned agent role prompts/contracts, including all 15 profiles in agents/profiles/.
- Tool-permission matrix by role.
- Explicit approval workflow for sensitive actions.
- Output artifact schema and task report format.

Acceptance:
- Sirfaraz is the only normal command interface.
- Agents receive only the permissions needed for their task.
- Agents cannot change the zero-spend rule.
- Completion requires artifacts and passing checks.
- Untrusted model output cannot execute arbitrary shell commands without policy validation.

## Phase 5 — Independent Progress Monitor

Deliverables:
- Separate read-only monitor process or isolated role.
- Repository and commit inspection.
- Test/build exit-code ingestion.
- Comparison between claimed status and observed evidence.
- Alert/report path directly to Zak.
- Monitoring schedule and health checks in the actual hosting environment.

Acceptance:
- Monitor can identify a missing file or commit despite a “completed” agent message.
- Monitor can identify failing tests despite a claimed success.
- Monitor credentials cannot write source files or modify audited evidence.
- If the monitor itself is unavailable, status is marked unverified rather than assumed healthy.

## Phase 6 — GitHub and release workflow

Deliverables:
- Scoped GitHub authentication through secret storage.
- Branch/commit/PR/report operations.
- Remote SHA verification after every push.
- CI checks, dependency review, secret scanning, release checklist, and rollback plan.

Acceptance:
- Failed remote writes are visible and do not count as completed.
- Every task report links to exact commits and changed paths where available.
- Secrets never enter commit history.
- Releases require passing checks and explicit approval.

## Phase 7 — Cloud runtime

Deliverables:
- Persistent API/control plane and worker.
- Durable database and queue.
- Secret manager, logs, health checks, backups, and restore runbook.
- Usage and provider-failure monitoring.
- Deployment and rollback instructions.

Acceptance:
- A task can continue when Zak's laptop and phone are offline.
- Worker restarts recover from durable state.
- Production services are not dependent on localhost URLs.
- Public network exposure is restricted to intended endpoints.
- The chosen host's current limits and sleeping behavior are documented.
- No deployment occurs without Zak's explicit approval.

## Phase 8 — Mobile-friendly dashboard

Deliverables:
- Secure login.
- Task creation and history.
- Live state, logs, artifact links, diffs, tests, and provider attempts.
- Approval inbox.
- Pause, resume, cancel, and safe retry.
- Usage/cost view with explicit $0-policy stops.
- Responsive layouts and clear error states.

Acceptance:
- All core controls work on mobile and desktop.
- Provider keys are never sent to the browser.
- Destructive actions require confirmation.
- UI does not imply success while work is running or unverified.

## Required task report

Every completed or blocked task must report:
- Task ID and requested objective.
- Final state.
- Changed files/artifacts.
- Commit SHA or explicit reason none exists.
- Tests run and exit codes.
- Provider/model attempts and available cost evidence.
- Monitor verdict.
- Known limitations and follow-up work.

## Global non-negotiable stop conditions

Pause and checkpoint on:
- No eligible free model route.
- Unknown or non-zero cost.
- Authentication/permission failure.
- Secret exposure or suspicious command.
- Required tests failing.
- Missing checkpoint before risky work.
- Deployment or external action without approval.

When stopped, report the exact blocker. Never buy credits, silently switch to a paid model, or claim the work completed.
