# ZEDCU Cost and Model Routing Policy

## Absolute budget

**Allowed spend: USD $0.** This is a hard rule, not a target or warning threshold.

Not allowed:
- Buying credits or subscribing/upgrading automatically.
- Falling back to a paid model because a free model is unavailable.
- Treating a router as free without checking the actual route and current terms.
- Claiming multiple routers multiply free quota when they reach the same upstream provider.
- Retrying indefinitely and consuming quota without bounded controls.

## Routing requirements

1. Maintain an explicit allowlist of verified free route identifiers.
2. Use free-routing mechanisms only when the provider documents behavior and the account has access.
3. Never accept an arbitrary model ID without policy validation.
4. Before dispatch, check route eligibility and pricing metadata. If unknown, deny.
5. Track attempted provider/model pairs per task to prevent repeating a failed route.
6. Classify failures: rate limit, quota exhausted, auth/permission, timeout, transient server error, invalid request, ambiguous price.
7. Use bounded retries with exponential backoff and jitter only for retryable failures.
8. After response, record available usage/cost evidence. If non-zero, invalid, or missing where required, reject the result and pause.
9. Treat provider-reported zero as evidence, not an absolute financial guarantee. Reconcile with provider usage records where available.
10. If all eligible free routes fail, checkpoint, pause, and notify Zak.

## Provider separation

- **OpenRouter:** one provider integration; route availability and free quotas depend on current configuration and upstream models.
- **OmniRoute:** separate routing integration. It may use some of the same upstream providers; do not count duplicate routes as independent capacity without evidence.
- **Direct provider APIs:** optional adapters only after current free-tier, quotas, terms, and billing behavior are verified.
- **Fallback:** means the next eligible free route, never a paid route.

## Secrets and billing safety

- API keys live in environment variables or a secret manager only.
- Never commit keys to GitHub or expose them in frontend code, logs, screenshots, or agent prompts.
- No agent may alter account billing, purchase credits, or upgrade plans.
- Policy changes require explicit owner approval; the runtime must enforce the currently configured hard zero limit.

## Acceptance tests

- Paid/unknown model ID is denied before any network call.
- Empty eligible-route list produces a safe pause.
- A failed route is not attempted repeatedly for the same task.
- Rate-limit response selects a different verified free route or pauses.
- Missing or non-zero cost evidence cannot mark a task successful.
- Quota exhaustion never triggers a paid fallback.
- Provider errors and retries appear in the audit trail.
