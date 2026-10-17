# ZEDCU Runtime Quick Start

This is a self-hostable API + worker baseline. It is not yet the complete Sirfaraz multi-agent system or mobile dashboard. No database host, model account, or deployment is created automatically by these instructions.

## Requirements

- Node.js 22 or newer and npm.
- A PostgreSQL database you are authorized to use, with the migration applied.
- A long random API token (at least 32 characters).
- An OpenAI-compatible endpoint and an exact model whose official free terms you personally verified before enabling worker execution.

Do not add payment details or enable paid upgrades. The application-level zero-cost guard is not an independent guarantee against provider billing.

## 1. Install and build

```sh
npm ci
npm run typecheck
npm test
npm run build
npm run lint
```

## 2. Configure the database and API

Copy `.env.example` to a private local `.env` file or configure the variables in your hosting provider's secret manager. Do not commit `.env`.

Set either `DATABASE_URL` or `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, and `PGPASSWORD`. For remote PostgreSQL, configure TLS with `PGSSL=true` only when the server presents a valid certificate chain. Configure `ZEDCU_API_TOKEN` with a random secret of at least 32 characters. Set a valid listening port in `PORT` if needed.

Apply the schema once to the target database:

```sh
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f migrations/001_durable_task_queue.sql
```

Start the API:

```sh
npm start
```

Open `http://localhost:8080/` for the responsive control dashboard. Paste the server token in the connection field; it stays in page memory and is not written to browser storage. Each task also offers a read-only Raza audit that checks persisted task/event/checkpoint consistency. It is an initial record-invariant check, not yet the separate independent cloud auditor or a check of external GitHub/CI evidence.

Health endpoints:
- `GET /health` — process liveness.
- `GET /ready` — PostgreSQL readiness.

## 3. Configure the worker only after verifying genuinely free model routes

Set these server-side variables in the worker's secret/configuration settings. Single-route mode uses the variables below. For multiple routes, set `ZEDCU_ROUTES_JSON` to an array of route metadata objects. Each object defines `id`, `gatewayId`, `provider`, `model`, `baseUrlEnv`, optional `apiKeyEnv`, `evidenceUrl`, `evidenceCheckedAt`, `confirmedFree`, `costUsdPerMillionTokens`, optional `priority`, optional `capabilities`, and optional `enabled`. The values of `baseUrlEnv` and `apiKeyEnv` are environment variable names, not secret values. Different route entries may use different gateways/providers; routes sharing a gateway ID must share the same endpoint and key settings.

- `ZEDCU_GATEWAY_BASE_URL`: trusted HTTPS OpenAI-compatible API base URL, usually ending in `/v1`.
- `ZEDCU_GATEWAY_API_KEY`: secret key if the endpoint requires it.
- `ZEDCU_GATEWAY_ID`: stable gateway ID, for example `openai-compatible`.
- `ZEDCU_UPSTREAM_PROVIDER`: actual upstream provider name.
- `ZEDCU_MODEL`: exact model identifier.
- `ZEDCU_ROUTE_CONFIRMED_FREE=true`: operator attestation after checking the exact model and account's official terms.
- `ZEDCU_ROUTE_COST_USD_PER_MILLION_TOKENS=0`: required explicit zero-price declaration.
- `ZEDCU_FREE_EVIDENCE_URL`: HTTPS URL for official pricing/terms.
- `ZEDCU_FREE_EVIDENCE_CHECKED_AT`: recent ISO timestamp when those terms were checked.

If any free-route setting is missing or its evidence is stale, the worker must not start or the route will be rejected. The code checks the metadata, not the contents of the URL. This remains an operator-verified configuration, not independent live pricing verification. Do not set the confirmation flag unless you verified the exact route.

Build and start a separate worker process:

```sh
npm run build
npm run start:worker
```

The worker claims durable PostgreSQL queue entries, attempts eligible configured routes in priority order, and records the result in a task checkpoint. Retryable failures may move to the next eligible route; if all eligible routes fail or zero cost cannot be established, the task is paused. This is a basic multi-route worker, not yet Sirfaraz orchestration or a complete specialist-agent runtime.

## 4. Submit a task

Use a unique idempotency key for each new task. Example:

```sh
curl -X POST "http://localhost:8080/v1/tasks" \
  -H "Authorization: Bearer $ZEDCU_API_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: test-task-0001" \
  -d '{"request":"Summarize the latest committed implementation status."}'
```

The API returns the task ID. Inspect all tasks or one task:

```sh
curl "http://localhost:8080/v1/tasks" -H "Authorization: Bearer $ZEDCU_API_TOKEN"
curl "http://localhost:8080/v1/tasks/TASK_ID" -H "Authorization: Bearer $ZEDCU_API_TOKEN"
```

The worker's output is stored as a checkpoint in the task record. Never expose the bearer token to browser JavaScript or commit it to GitHub.

## Current limitations

- No hosting or database is provisioned by this repository.
- A basic responsive control dashboard is included, but there are no user accounts or role-based multi-user auth. Sirfaraz, specialist agent execution, and the separate Raza monitor remain unfinished.
- The API uses one bearer token; this is a starter control plane, not a complete multi-user identity system.
- The worker supports multiple configured OpenAI-compatible routes; native provider protocols need separate adapters.
- No automated production backups are configured. Complete a tested restore drill before storing important data.
- Pause/cancel changes are checked after the current model request returns; they do not forcibly abort every in-flight upstream request yet.\n- No cloud deployment or production-readiness claim is implied by local startup instructions.
