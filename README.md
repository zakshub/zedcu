# ZEDCU — Zero-Budget, Evidence-Driven Command Universe

ZEDCU is a planned cloud-hosted AI operating system: one command interface, specialist agents, controlled execution, independent progress verification, durable checkpoints, GitHub-backed artifacts, and a mobile-friendly dashboard.

> **Hard financial boundary: USD $0 monthly spend.** No purchases, paid model fallback, automatic upgrades, or hidden paid routes. Free quotas are finite. When eligible free routes are exhausted or pricing cannot be verified, pause and notify Zak.

## Direction and authority

- **Owner / final authority:** Zak.
- **Sirfaraz:** the sole central command agent; translates Zak's requests into plans, approvals, task dispatch, and reports.
- **Progress Monitor:** a separate read-only observer. It independently checks repository state, files, commits, logs, and test outputs. It must not accept Sirfaraz's claims as proof.
- **GitHub:** durable source control and audit trail; it is not a compute host.
- **Cloud runtime:** target so jobs can run while Zak's laptop and phone are off.
- **Mobile dashboard:** future control surface for task submission, approvals, progress, logs, diffs, tests, usage, pause/resume/cancel.
- **OpenRouter and OmniRoute:** separate integrations, not interchangeable names. Multiple routers do not magically multiply an upstream provider's free quota.

## Current repository truth

This repository is being initialized with the documented project direction and staged implementation plan. The presence of planning files does not mean the full agent runtime, dashboard, or cloud service already exists.

## Non-negotiable rules

1. **No-cost enforcement:** allowlist free routes only; never silently fall back to paid models.
2. **Fail closed:** if route pricing, reported cost, or provider eligibility is ambiguous, stop the request and checkpoint.
3. **Evidence over status messages:** completion requires inspectable artifacts and passing checks.
4. **Human authority:** destructive operations, deployment, secrets, account changes, and external writes require explicit approval.
5. **Recoverability:** persist task state and checkpoints before long operations.
6. **Least privilege:** agents get only the permissions needed for their role.
7. **Honest reporting:** distinguish planned, implemented, tested, deployed, and independently verified.
8. **No fabricated recovery:** never claim new baseline files recover an earlier unverified OpenCode session.

## Planned agent structure

See [docs/AGENTS.md](docs/AGENTS.md), [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/IMPLEMENTATION_SPEC.md](docs/IMPLEMENTATION_SPEC.md), [docs/COST_POLICY.md](docs/COST_POLICY.md), [docs/SECURITY.md](docs/SECURITY.md), [docs/ROADMAP.md](docs/ROADMAP.md), and [docs/DECISIONS.md](docs/DECISIONS.md).

## Staged delivery

- Stage 0: versioned plan and governance baseline.
- Stage 1: reliable free-only model routing with failure classification and tests.
- Stage 2: durable task store, queue worker, checkpoints, and recovery.
- Stage 3: Sirfaraz command orchestration and scoped specialist agents.
- Stage 4: independent evidence-based monitor, CI, GitHub reporting, audit logs.
- Stage 5: cloud runtime and secure mobile-friendly dashboard.

Do not skip cloud deployment before routing, persistence, monitoring, and security foundations work.

## Operating rule when a free model fails

1. Classify the failure (rate limit, quota, auth, timeout, provider outage, ambiguous pricing).
2. Try another **verified eligible free route** only if one is configured and the task has not already attempted it.
3. Use bounded retries and backoff; never loop on the same failed route.
4. If all eligible free routes fail, save state, pause, and report the blocker.
5. Never buy credits or use a paid route to keep going.

## Implementation truth

This repository's planning documents are not a runnable implementation. Runtime features must be marked complete only after code exists, checks pass, and remote commit contents are verified.
