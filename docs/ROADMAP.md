# ZEDCU Master Roadmap

## Product objective

Build ZEDCU as a persistent, cloud-hosted, provider-neutral AI operating system. Zak submits a goal from a mobile-friendly dashboard; Sirfaraz scopes and coordinates the work; specialist agents execute bounded assignments; tests and Raza independently verify evidence; Zak retains final authority over consequential actions.

GitHub is the versioned source of truth and audit trail, not the production runtime. The runtime must keep working when Zak's laptop and phone are offline.

## Global acceptance rules

A milestone is complete only when implementation exists, automated checks pass, evidence is recorded, and Raza can independently verify the result. A plan, generated code, documentation update, successful push, or green documentation-only workflow does not by itself prove a feature is implemented or deployed.

- Hard spending ceiling: USD $0/month. No paid fallback, paid credits, auto-upgrades, or unapproved purchases.
- If route eligibility, terms, quota, or cost is uncertain, stop before invoking the provider.
- Never commit credentials. Keep secrets server-side and out of logs, artifacts, browser storage, and task responses.
- Do not merge PR #2, provision infrastructure, or deploy to production without Zak's explicit approval.
- Use least privilege, durable checkpoints, idempotency, optimistic concurrency, and auditable state transitions.
- Report implemented, tested, independently verified, and deployed as separate states.

## Milestone 0 — Governance and repository baseline

**Status: Baseline established; ongoing controls remain.**

- [x] Confirm repository `zakshub/zedcu`, default branch `main`, implementation branch, and draft PR #2.
- [x] Document the product goal, authority hierarchy, agent roster, zero-spend rule, architecture, and stop conditions.
- [x] Establish TypeScript, Node 22 lockfile, CI, build, lint, tests, dependency audit, and PostgreSQL schema checks.
- [ ] Add automated secret scanning and dependency review as explicit CI gates.
- [ ] Reconcile historical local work only if it is found; do not claim recovery without evidence.

**Exit criteria:** repository state and policy are documented; required checks pass on the exact candidate commit.

## Milestone 1 — Safe, provider-neutral model routing

**Status: Adapter and route-selection foundation implemented; no live route verified.**

- [x] Define provider adapter contracts and generic OpenAI-compatible adapter.
- [x] Add gateway registry, capability-aware selection, priority ordering, cooldown filtering, and bounded alternate-route attempts.
- [x] Reject unknown or non-free route metadata before provider invocation.
- [x] Keep credentials in server-side configuration.
- [ ] Verify current official terms and eligibility for concrete free models; record URL, date, quotas, and conditions.
- [ ] Add per-task durable route-attempt ledger, normalized provider error records, and bounded exponential backoff.
- [ ] Record token usage, quota evidence, and cost evidence; stop if cost cannot be established.
- [ ] Add integration tests proving no request reaches a route marked paid, unknown, or unverified.
- [ ] Run a controlled live smoke test only after free eligibility and zero-cost conditions are evidenced.

**Exit criteria:** safe route selection is tested; any live route has current eligibility evidence and auditable usage/cost reporting.

## Milestone 2 — Durable task lifecycle and approval records

**Status: PostgreSQL task store, queue, leases, idempotency, checkpoints, and state transitions exist; durable plans/approval records and full runtime integration remain.**

- [x] Persist task records, state transitions, checkpoints, and audit events in PostgreSQL.
- [x] Implement atomic task-plus-queue submission, idempotency, worker leases, optimistic versioning, and atomic resume/requeue.
- [x] Add authenticated task submission, history, inspection, and constrained pause/resume/cancel/approval actions.
- [ ] Define typed plan, approval request/decision, execution-step, artifact, provider-attempt, and cost-evidence records.
- [ ] Persist Sirfaraz's plan against its task and version it; plan preview must not silently approve or execute work.
- [ ] Make approval decisions auditable, actor-attributed, time-stamped, scoped to a specific action and plan version, and invalidated when the approved scope changes.
- [ ] Enforce approval gates in the execution service, not only in UI or prompt instructions.
- [ ] Test duplicate submissions, concurrent approval attempts, stale plan approvals, worker restarts, expired leases, and resume after checkpoints.
- [ ] Improve in-flight cancellation, deadlines, shutdown behavior, and safe interruption of upstream requests.

**Exit criteria:** plans and approvals survive restarts, stale approvals cannot authorize changed work, and all lifecycle transitions have tests and audit evidence.

## Milestone 3 — Sirfaraz command and orchestration engine

**Status: Deterministic zero-cost plan preview exists; natural-language orchestration and real specialist dispatch are not implemented.**

- [x] Add authenticated `POST /v1/plan` deterministic preview with a hard zero-spend ceiling and stop conditions.
- [ ] Convert a task request into structured objective, acceptance criteria, constraints, scope, risks, and expected artifacts.
- [ ] Persist plans and expose plan review and approval through the API/dashboard.
- [ ] Build an execution coordinator that advances durable plan steps, leases work, records outputs, and recovers after restart.
- [ ] Implement specialist contracts: input schema, allowed tools, permissions, output schema, budget boundary, timeout, and verification criteria.
- [ ] Register the 15 named roles and map work by capability rather than relying only on keyword heuristics.
- [ ] Dispatch only approved, in-scope work; route all consequential actions through enforced approval gates.
- [ ] Add mocked-gateway end-to-end tests from task submission through plan, execution, checkpoint, test, and final report.
- [ ] Add real model-backed planning only after free route eligibility and spend enforcement are verified.

**Exit criteria:** a task can move from request to structured plan to authorized execution and evidence-backed completion without losing state.

## Milestone 4 — Specialist team

**Status: Role names and initial profiles exist; agents are not yet independently executable workers.**

- [ ] Sirfaraz — central commander and sole normal command interface.
- [ ] Raza — read-only progress monitor and verification auditor; never edits code or grants approval.
- [ ] Shoaib — architecture.
- [ ] Moiz — technical integration.
- [ ] Taimoor — research and evidence.
- [ ] Diya — product management.
- [ ] Haida — UX and product design.
- [ ] Hamza — problem framing and critical thinking.
- [ ] Adeel — implementation execution.
- [ ] Dr Akram — QA and testing.
- [ ] Hania — security and privacy.
- [ ] Mavia — DevOps and cloud reliability.
- [ ] Bilal — documentation and knowledge.
- [ ] Zara — release auditing.
- [ ] Faris — cost and provider-policy auditing.
- [ ] Define role-specific tool allowlists, access boundaries, escalation rules, and output contracts.
- [ ] Test cross-agent handoffs, conflicting recommendations, untrusted input handling, and denial of out-of-scope requests.

**Exit criteria:** agents have enforced permissions and structured handoffs; names and prompts alone do not count as functional agents.

## Milestone 5 — Raza independent verification and monitoring

**Status: Read-only audit modules and authenticated endpoints exist inside the API process; separate service and scheduled monitoring remain.**

- [x] Audit task record/event/checkpoint invariants.
- [x] Compare configured branch HEAD SHA with CI for that exact SHA and require successful `checks` and `postgres-schema` jobs.
- [ ] Extract Raza into a separate read-only runtime/service boundary with separate credentials and no write permissions.
- [ ] Schedule repository, CI, task, and deployment-health checks.
- [ ] Verify diffs, changed files, test results, artifacts, release state, and runtime health—not only reported status.
- [ ] Detect missing, stale, contradictory, or fabricated progress claims.
- [ ] Emit discrepancy reports directly to Zak through a durable notification/inbox mechanism.
- [ ] Store timestamped evidence snapshots and preserve audit history.

**Exit criteria:** Raza can independently verify the current state, report discrepancies, and continue monitoring without relying on Sirfaraz's self-report.

## Milestone 6 — GitHub integration and engineering workflow

**Status: GitHub is used as a source repository and CI system; authenticated task-driven GitHub operations remain unimplemented.**

- [ ] Implement narrowly scoped GitHub issue, branch, commit, diff, CI, and report operations.
- [ ] Require explicit approval for merge, release, repository settings, permission changes, and destructive operations.
- [ ] Verify remote commit SHA and changed paths after each write.
- [ ] Add secret scanning, dependency review, artifact retention, and release provenance checks.
- [ ] Add safe PR creation and update flows; do not auto-merge.
- [ ] Store operation evidence in task records and checkpoints.

**Exit criteria:** GitHub actions are least-privilege, auditable, approval-gated, and independently verified.

## Milestone 7 — Mobile-friendly control dashboard

**Status: Responsive starter dashboard exists; production identity and richer observability remain.**

- [x] Task submission, task history, task inspection, checkpoint visibility, basic task actions, and read-only task audit.
- [ ] Add plan review, approval inbox, approval history, and scope-change invalidation.
- [ ] Show live task/step state, timestamps, logs, route attempts, checkpoints, artifacts, diffs, test output, and failure reasons.
- [ ] Show provider eligibility evidence, usage, quota observations, and a clear USD $0 stop state.
- [ ] Add polling or event streaming with reconnect/recovery behavior.
- [ ] Implement secure login, user identity, role-based authorization, session expiry, CSRF protections where applicable, and accessible status feedback.
- [ ] Verify layout and core actions on mobile and desktop.

**Exit criteria:** Zak can control and inspect work from a phone while the cloud runtime continues independently.

## Milestone 8 — Cloud runtime and operations

**Status: Runtime entry points and operational documentation exist; nothing is provisioned or deployed.**

- [x] Document candidate free-tier databases/hosts, backup/recovery, and operational considerations.
- [ ] Validate the selected host against current free-tier terms, sleep limits, storage durability, networking, logs, and resource limits.
- [ ] Choose and provision database/runtime only after explicit approval.
- [ ] Configure server-side secrets and least-privilege GitHub/provider credentials.
- [ ] Deploy API, worker, and independent Raza monitor with health/readiness checks.
- [ ] Configure scheduled backups and perform a successful restore drill.
- [ ] Test restarts, worker crashes, database interruption, queue recovery, cancellation, and rollback.
- [ ] Confirm tasks continue while the laptop and phone are offline.
- [ ] Document deployment, incident response, recovery, and teardown procedures.

**Exit criteria:** deployed services are healthy, recoverable, monitored, and demonstrably within approved zero-cost limits.

## Milestone 9 — Release readiness

- [ ] Complete security review and threat model.
- [ ] Complete end-to-end tests against disposable PostgreSQL and mocked model gateways.
- [ ] Complete one controlled free-route smoke test with evidence of current terms and no paid fallback.
- [ ] Complete backup restore and worker recovery drills.
- [ ] Have Raza verify the candidate commit, checks, permissions, approval gates, and deployment evidence.
- [ ] Present a release report with known limitations and unresolved risks.
- [ ] Obtain Zak's explicit approval before merging or production deployment.

## Current execution order

1. Add durable plan/approval data contracts and storage without changing default-branch behavior.
2. Connect Sirfaraz plan creation to a task lifecycle while preserving the rule that planning never equals approval.
3. Add execution-coordinator and worker integration tests with mocked gateways.
4. Enforce approval decisions and safe cancellation at the execution boundary.
5. Split Raza into a read-only monitoring service and add scheduled discrepancy reporting.
6. Verify free model eligibility and cost controls from current official evidence.
7. Improve the dashboard around plans, approvals, execution steps, and verification.
8. Evaluate hosting and deployment only after implementation evidence is strong and Zak approves provisioning.

## Global stop conditions

Stop before an action if free eligibility or cost is uncertain, credentials or permissions are unsafe, required tests fail, the approval is absent or stale, a checkpoint is missing, or independent evidence disagrees with reported status. Preserve the evidence and report the blocker; never bypass the stop condition to keep a task moving.
