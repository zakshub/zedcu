# ZEDCU Architecture

## Product goal

A persistent, cloud-hosted multi-agent work system controlled by Zak from a phone or laptop. Work should continue when both personal devices are offline. The system must be observable, recoverable, cost-constrained, and honest about actual completion.

## High-level flow

```text
Zak
  |
  v
Mobile-friendly Control Dashboard / Command API
  |
  v
Sirfaraz — sole command agent
  |---- plans and task breakdown
  |---- requests approval when policy requires it
  |---- dispatches scoped tasks
  v
Task Queue + Durable Task Store + Checkpoints
  |
  +--> Specialist agents (isolated permissions)
  +--> Provider Router (verified free routes only)
  +--> Artifact workspace / Git working tree
  +--> Tests, lint, typecheck, security checks
  |
  v
Independent Progress Monitor (read-only)
  |
  v
Evidence-based report + GitHub commits + notifications
```

## Components

### Command API and dashboard
- Accept tasks; display status, approvals, logs, changed files, test results, and usage.
- Support pause, resume, cancel, and safe retry.
- Authenticate every action; never expose provider keys in browser code.
- Dashboard is a control plane, not the authority that decides whether work is correct.

### Sirfaraz
- Sole normal command interface between Zak and the agent team.
- Turns requests into plans with acceptance criteria.
- Dispatches scoped tasks with explicit permissions and the USD $0 budget.
- Cannot override cost rules, bypass approvals, or mark work complete without evidence.
- Reports uncertainty and blockers honestly.

### Task orchestration
- Durable states: `queued`, `planning`, `running`, `waiting_for_approval`, `paused`, `failed`, `completed`, `cancelled`.
- Store task ID, request, plan, role, provider attempts, timestamps, checkpoints, artifacts, test evidence, approvals, and final report.
- Use idempotency keys and bounded retries.
- Recover unfinished tasks after process restart.

### Provider router
- Separate adapters for OpenRouter, OmniRoute, and any direct provider API approved after verification.
- Route only to an explicit allowlist of verified free routes.
- Track attempted provider/model pairs per task to prevent repeating the same failed option.
- Classify errors and use bounded exponential backoff.
- Enforce zero-spend policy before requests and inspect usage/cost evidence after responses.
- If cost cannot be confidently established as zero, reject the result and pause.
- Do not claim multiple routers multiply quota when they share an upstream provider.

### Specialist agents
- Receive narrow instructions, expected outputs, tool permissions, and acceptance criteria.
- No blanket authority over deployment, secrets, account settings, or destructive actions.
- Return artifacts and evidence, not just claims.
- Prefer small, reviewable diffs.

### Independent Progress Monitor
- Separate read-only role/process from Sirfaraz.
- Verify commits, files, changed paths, test exit codes, build outputs, and runtime health evidence.
- Compare declared status against observed status and flag mismatches directly to Zak.
- Cannot modify source code or approve its own findings.
- A periodic loop is not considered implemented until it actually runs in the target environment.

### GitHub integration
- Version-controlled source, issue/PR workflow, audit history, and reports.
- Use scoped tokens in cloud secrets; never hardcode tokens or commit `.env`.
- Verify remote commit SHA and changed paths after every push.
- GitHub alone does not run background tasks.

### Cloud runtime
- Long-running worker, durable database, queue, logs, secret manager, and health checks.
- Hosting selection must account for free-tier limits, sleeping, compute, storage, egress, and changing policies.
- No deployment until explicit approval and security review.
- Do not use localhost database/queue URLs in production.

## Planned data model

- `Task`: id, created_by, request, status, plan, created_at, updated_at, idempotency_key.
- `TaskEvent`: task_id, event_type, actor, timestamp, structured_payload.
- `ProviderAttempt`: task_id, provider, model_route, attempt_number, outcome, duration, cost_evidence.
- `Checkpoint`: task_id, checkpoint_number, state_snapshot, artifact_refs, created_at.
- `Artifact`: task_id, path/url, kind, content_hash, produced_by, verified_at.
- `Approval`: task_id, action, requested_by, decision, decided_by, timestamp.
- `VerificationRun`: task_id, checks, exit_codes, commit_sha, monitor_verdict.

## Failure behavior

- Persist checkpoint before long or risky stages.
- Use bounded retries; no infinite loops.
- Rate limit/quota: mark route unavailable temporarily and consider another eligible free route.
- Invalid key/permission: stop and request user action.
- Ambiguous cost: reject/stop.
- All free routes unavailable: pause and notify.
- Tests fail: do not label task completed.
- GitHub push fails: retain local artifacts if available and clearly report push failure.
- Worker restart: restore durable state and avoid duplicate side effects.

## Scope boundary

This is target architecture unless repository artifacts and tests prove implementation. See `../STATUS.md`.
