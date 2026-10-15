# ZEDCU Architecture Decision Records

## ADR-001 — Zak retains final authority
**Decision:** Zak is owner and final authority. Sirfaraz is the sole command agent, not the owner.  
**Reason:** A clear authority boundary prevents agents from silently changing project direction.  
**Consequence:** Sensitive actions require approval gates.

## ADR-002 — Hard USD $0 spend ceiling
**Decision:** No paid model routes, purchases, or automatic account upgrades.  
**Reason:** The project must fit the user's actual budget.  
**Consequence:** Free quotas may halt work; safe pausing is preferable to paid fallback.

## ADR-003 — Independent Progress Monitor
**Decision:** A separate read-only monitor verifies real artifacts and may report discrepancies directly to Zak.  
**Reason:** An executor must not be the sole judge of its own progress.  
**Consequence:** Monitor needs independent access to GitHub, test outputs, logs, and runtime health evidence.

## ADR-004 — Cloud runtime, not device-dependent execution
**Decision:** Target cloud infrastructure so work continues while the laptop and phone are off.  
**Reason:** Mobile is for control and monitoring, not required compute.  
**Consequence:** GitHub alone is insufficient; persistent hosting, storage, and workers are required.

## ADR-005 — GitHub as source of truth
**Decision:** Code, architecture, decisions, and auditable reports are version-controlled in GitHub.  
**Reason:** Work must be durable, reviewable, and recoverable.  
**Consequence:** A reported file write is not accepted until remote contents and commit are verified.

## ADR-006 — Separate provider integrations
**Decision:** OpenRouter and OmniRoute remain distinct adapters; direct provider adapters are added only after free-tier verification.  
**Reason:** Routing products and upstream quotas differ; duplicate routes may share capacity.  
**Consequence:** Route health and usage are tracked by provider/model pair.

## ADR-007 — Evidence-based completion
**Decision:** Completion requires artifacts and passing checks, not agent statements.  
**Reason:** The earlier workflow reported file writes without a confirmed repository result.  
**Consequence:** Every milestone has acceptance criteria and independent verification.
