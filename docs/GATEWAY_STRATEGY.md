# ZEDCU Gateway Strategy

## Decision

ZEDCU will not be tied to OpenRouter, OpenCode, OmniRoute, or any single gateway. Gateways are replaceable transport integrations. The internal task, agent, policy, audit, and verification layers must not depend on one vendor's API shape.

## Separate the layers

1. **Agent/runtime layer** — Sirfaraz and specialist agents request model capabilities.
2. **Policy and route layer** — applies the hard USD $0 rule, route evidence freshness, per-task attempt limits, model requirements, and failure policy.
3. **Gateway adapter layer** — connects to one gateway or a direct provider through a normalized adapter.
4. **Upstream model/provider layer** — the model actually serves the request and owns its quota, terms, and potentially its billing.
5. **Evidence layer** — records gateway, upstream provider/model when known, route attempts, usage, cost evidence, and uncertainty.

A gateway and an upstream provider are not the same thing. Different gateways can expose the same upstream model; this does not create additional model quota or make a paid model free.

## Candidate integrations to evaluate

These are candidates, not claims that ZEDCU has already integrated, tested, or approved them:

- OmniRoute
- OpenRouter
- OpenAI-compatible local or self-hosted gateways such as LiteLLM, Bifrost, Portkey Gateway, and New API
- Agent Router / Envoy AI Gateway
- Kong AI Gateway
- Cloudflare AI Gateway
- Direct provider adapters where official terms and zero-cost eligibility can be verified

OpenCode is a possible development client/tooling option, not a required routing dependency. It must not be confused with a provider, a gateway, or a source of free quota.

## Registry and adapter contract

The runtime uses a gateway registry with descriptors for:
- stable gateway ID and display name
- hosted, self-hosted, or direct-provider kind
- native or OpenAI-compatible protocol
- enabled/disabled state
- environment-variable names for configuration (never secret values)
- streaming and cancellation capabilities

Each integration must be independently switchable. Adding or disabling a gateway must not require changes to Sirfaraz, the task store, or the agent contracts. The adapter normalizes responses and errors into ZEDCU's internal contract.

The current registry is an extension point only. No real OmniRoute, OpenRouter, LiteLLM, or other network adapter is implied by this code.

## Zero-spend gate

A gateway is transport, not proof of free use. Before dispatch, each concrete route must pass the current zero-cost policy with recent official evidence. After the response, cost/usage evidence is recorded and checked. Missing, ambiguous, stale, or non-zero cost evidence pauses the task. The policy must fail closed even if a gateway reports a model as available.

A future evidence source may be an official pricing page, official API response, provider quota endpoint, or approved local configuration backed by current documentation. Evidence must identify what it proves and when it was checked. Marketing labels such as "free", "open source", or "self-hosted" are not sufficient proof that inference has zero cost.

## Dynamic routing behavior

The router should be able to:
- disable one gateway without disabling other integrations
- rank eligible routes by explicit priority after capability requirements and cooldown/availability gates pass
- record capability requirements for a task and skip routes that cannot satisfy them
- honor route cooldown timestamps after rate limits or transient provider health problems
- use bounded failover across distinct gateway/model routes
- avoid repeating attempted routes for the same task
- apply cooldowns to rate-limited routes
- pause when no verified free route remains
- add new adapters without changing agent orchestration

Route priority is a preference only and can never override the zero-cost policy. Routing must remain deterministic enough to audit. Any ranking decision should record the candidates, exclusions, selected route, and reason. Never silently switch to paid usage.

## Integration checklist

Before enabling an integration:
1. Confirm the project's license, maintenance status, and deployment model from authoritative sources.
2. Confirm supported API protocol, authentication, streaming, cancellation, and error behavior.
3. Verify current upstream model IDs, official free-tier terms, quota limits, and billing behavior.
4. Test rate limits, authentication failures, timeouts, cancellation, malformed responses, and missing cost evidence with mocks.
5. Store secrets only in the runtime's secret configuration; never in source control or browser code.
6. Run the security review and zero-spend acceptance tests.
7. Enable it only after the evidence is recorded and the owner approves any external deployment.

## Non-goals

- Do not hard-code one preferred gateway as the permanent default.
- Do not assume that gateways aggregate or multiply free quotas.
- Do not route around provider limits or terms.
- Do not treat open-source software as equivalent to free hosted inference.
- Do not enable paid fallback, automatic upgrades, or credit purchases.
