# ZEDCU — Zero-Budget, Evidence-Driven Command Universe

ZEDCU is being built as a cloud-hosted AI operating system. The feature branch now includes a PostgreSQL-backed task API/queue foundation and a generic OpenAI-compatible model adapter; Sirfaraz orchestration, specialist execution, the independent Raza monitor, hosted deployment, and the mobile dashboard remain unfinished.

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

The current feature branch has executable API and worker entry points plus tests. It is not deployed, and it does not yet implement the complete multi-agent operating system. See [the quick-start guide](docs/QUICKSTART.md) for local setup, environment requirements, and the current limitations. The [status file](STATUS.md) distinguishes tested code from unfinished and undeployed features.

## Non-negotiable rules

1. **No-cost enforcement:** allowlist free routes only; never silently fall back to paid models.
2. **Fail closed:** if route pricing, reported cost, or provider eligibility is ambiguous, stop the request and checkpoint.
3. **Evidence over status messages:** completion requires inspectable artifacts and passing checks.
4. **Human authority:** destructive operations, deployment, secrets, account changes, and external writes require explicit approval.
5. **Recoverability:** persist task state and checkpoints before long operations.
6. **Least privilege:** agents get only the permissions needed for their role.
7. **Honest reporting:** distinguish planned, implemented, tested, deployed, and independently verified.
8. **No fabricated recovery:** never claim new baseline files recover an earlier unverified OpenCode session.

## Current runtime entry points\n\n- `npm start`: authenticated HTTP task API, backed by PostgreSQL.\n- `npm run start:worker`: one-route worker using the generic OpenAI-compatible adapter and strict free-route metadata gate.\n- `npm run build`: compile TypeScript before starting either process.\n- [Quick-start guide](docs/QUICKSTART.md): configuration, migration, task submission, and limitations.\n\nThese commands do not provision a database or deploy the service. A valid PostgreSQL database and carefully verified free-model configuration are required for end-to-end execution.\n\n## Planned agent structure

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
