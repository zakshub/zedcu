# Runtime Baseline — Stage 1A

## What exists

- A dependency-free Node.js 22+ project entry point.
- A fail-closed route policy requiring an enabled route, explicit `pricing: "free"`, and recent pricing evidence.
- Selection of the next eligible route without repeating attempted route IDs.
- Provider failure classification and a bounded retry decision helper.
- Automated tests using Node's built-in test runner.
- GitHub Actions CI for syntax checks and tests.

## What does not exist yet

- No real provider adapter, API call, automatic fallback request, task database, queue, checkpoint store, agent execution, dashboard, or cloud deployment.
- No route in this repository is pre-approved as actually free. The test route uses a reserved example URL and is only a fixture.
- The current pricing-evidence validation checks structure and freshness; it does not independently verify the source URL or a provider's current account-specific terms.
- The code does not estimate or guarantee provider billing. Real adapters must be blocked until official route pricing, account eligibility, billing behavior, and terms have been reviewed.

## Local checks

Requirements: Node.js 22 or newer.

```sh
npm run check
npm test
node src/index.js
```

The entry point reports `networkRequestsEnabled: false`. Keep network calls disabled until the provider adapter and zero-spend enforcement have separate tests and an explicit owner-reviewed route allowlist.

## Next implementation step

Build a provider adapter interface around this policy, starting with a mock adapter and contract tests. Add real OmniRoute/OpenRouter adapters only after the current official pricing and free-tier behavior are documented. Never treat router access as proof that the selected upstream model is free.
