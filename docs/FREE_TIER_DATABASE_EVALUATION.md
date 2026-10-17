# Free-Tier PostgreSQL Evaluation

**Reviewed:** 2026-10-16  
**Decision:** No provider selected or provisioned. This is a documented shortlist, not approval to create an account, attach billing, or deploy production data.

ZEDCU requires durable task state and queue leases, a hard USD $0 spending rule, external access for cloud workers, and a practical recovery path. A free label alone is insufficient: database expiry, inactivity shutdown, backup support, and connection limits matter.

## Comparison

| Provider | Officially documented free allowance / behavior | Backup and continuity concerns | ZEDCU assessment |
|---|---|---|---|
| **Aiven for PostgreSQL** | 1 CPU, 1 GB RAM, 1 GB disk; no credit card; no fixed time limit. | Single node; maximum 20 connections; no connection pooling on the free tier; service may power off after inactivity. Aiven lists backups, but restore behavior and retention must be checked in the account and tested. | **Strong candidate for a controlled integration-test / early prototype**, provided the pool and worker connection budget stay below 20 and an independent export/restore drill succeeds. Not HA production infrastructure. |
| **Neon Free** | As of 2026-10-02, Neon says 100 projects with 1 GB PostgreSQL storage per project. Free compute scales to zero after inactivity; the monthly compute allowance and restore-history window are plan-limited. | Scale-to-zero can add cold-start latency. Restore-history defaults and compute limits have changed over time; verify the current account limits before relying on recovery features. Do not treat provider history as the only backup. | **Strong candidate for development and ephemeral CI/integration environments**. Could be evaluated for an early prototype after confirming current compute, restore, and connection limits. |
| **Supabase Free** | 500 MB database per project; free projects can be paused after seven days of low activity. | Automatic backups and point-in-time recovery are not included in the Free plan. A paused project can be resumed, but that is not a substitute for a tested independent backup. | **Not preferred for the durable task queue** unless an independent backup/export routine is proven and inactivity pauses are acceptable. |
| **Render Free Postgres** | 1 GB storage, one active free database per workspace. | Database expires 30 days after creation; after the grace period, data is deleted. Free databases do not support backups or managed connection pooling. | **Reject for ZEDCU's durable task state**. Expiry and lack of backups conflict with the recovery requirement. Suitable only for disposable experiments. |

## Shortlist and recommendation

1. **Prototype evaluation: Aiven and Neon.** Test each without creating any paid resource. Aiven's documented backup inclusion is attractive, but the 20-connection ceiling and inactivity shutdown require explicit controls. Neon offers more storage per project as of October 2026 and scale-to-zero, but compute and restore history are limited.
2. **Do not select a production database yet.** No free option reviewed here establishes the reliability, support, retention, or service-level guarantees needed to claim production durability.
3. **Use GitHub Actions' ephemeral PostgreSQL service for CI.** It is already working and avoids a long-lived hosted database for tests.
4. **Before any hosted trial**, confirm the exact current plan limits, no-card / billing requirements, region and latency, TLS, connection limits, backup retention, export method, restore procedure, and the provider's shutdown/expiry policy. Do not add a payment method or enable a paid upgrade without Zak's explicit approval.
5. **Test migration portability** by applying `migrations/001_durable_task_queue.sql` to a fresh database and running `npm run test:postgres`. Keep a provider-independent `DATABASE_URL` / standard PostgreSQL connection path.
6. **Keep a separate encrypted export** and run a restore drill before storing any real user/task data. A green CI migration test is not a backup test.

## $0 policy controls

- Do not enable auto-upgrade, paid compute, paid backup, or paid storage.
- Set any available provider spending limit to $0 only if the provider documents that it truly blocks charges; do not rely on alerts as a hard stop.
- Keep credentials in secret storage and never in GitHub files, logs, issue text, or task audit events.
- Pause task dispatch when the database is unavailable, free quota is exhausted, or cost status is unclear.
- Recheck provider terms immediately before provisioning; this review is a snapshot and may become stale.

## Official sources

- Aiven free-tier documentation (last updated 2026-09-08): https://aiven.io/docs/products/postgresql/concepts/pg-free-tier
- Aiven free PostgreSQL overview: https://aiven.io/free-postgresql-database
- Neon free plan storage update (2026-10-02): https://neon.com/blog/neon-free-plan-1-gb-per-project
- Neon compute documentation: https://neon.com/docs/manage/endpoints/
- Neon free-plan usage guidance: https://neon.com/blog/how-to-make-the-most-of-neons-free-plan
- Supabase billing / free-plan limits: https://supabase.com/docs/guides/platform/billing-on-supabase
- Supabase free-project pausing: https://supabase.com/docs/guides/platform/free-project-pausing
- Render free service limits: https://render.com/docs/free

