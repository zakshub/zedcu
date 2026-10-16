# PostgreSQL task and queue persistence design

**Status:** schema proposal committed for review; no database is provisioned or connected.

## Purpose

Replace the single-process JSON task store and in-memory queue with shared durable storage before running more than one worker. This schema is PostgreSQL-specific and intentionally introduces no paid service or provider dependency.

## Tables

- `zedcu_tasks`: current task state, optimistic version, timestamps, and last error.
- `zedcu_task_checkpoints`: ordered checkpoint summaries and JSON artifact-path lists.
- `zedcu_task_audit_events`: append-oriented, per-task ordered event history.
- `zedcu_task_queue`: durable queue status, unique idempotency key, attempts, and lease ownership.
- `zedcu_schema_migrations`: applied migration versions.

## Required transaction boundaries

1. **Create task:** in one database transaction insert the task, initial `created` audit event, and queue row. If any insert fails, roll back all of them.
2. **Idempotent submission:** treat a repeated idempotency key for the same task as a repeat request; reject a key already assigned to another task. Never silently create a second task.
3. **Claim:** in a short transaction select one queued or expired-lease row using `FOR UPDATE SKIP LOCKED`, then set a fresh UUID lease token, worker ID, expiry, and increment attempts before commit.
4. **Acknowledge/release:** update only when task ID, current lease token, status, and unexpired lease all match. A stale worker must not acknowledge or release a reclaimed lease.
5. **Task update:** use `WHERE id = $1 AND version = $expectedVersion`; increment the version in the same update. Zero rows updated means a concurrency conflict.
6. **Audit/checkpoint:** write the state/checkpoint change and its audit event in the same transaction.

## Lease claim shape

The eventual adapter should claim inside a transaction with a query equivalent to:

```sql
SELECT task_id
FROM zedcu_task_queue
WHERE status = 'queued'
   OR (status = 'leased' AND lease_expires_at <= clock_timestamp())
ORDER BY enqueued_at, task_id
FOR UPDATE SKIP LOCKED
LIMIT 1;
```

After locking the row, update its lease fields and increment `attempts` before committing. Do not keep a transaction open while an agent or provider is doing work.

## Safety boundaries

- This migration is a schema foundation, **not** a working PostgreSQL adapter.
- Do not store provider API keys, raw secrets, or credentials in task requests, audit events, or artifacts.
- Keep the $0 route policy in application code as a mandatory gate; the database schema cannot establish whether a provider route is actually free.
- Configure backups, connection pooling, TLS, least-privilege database roles, retention, and recovery drills before production.
- PostgreSQL availability or a free-tier label does not imply a permanent free service. Select a host only after checking current limits and requiring explicit approval before any paid resource.
- Queue delivery is at-least-once in the presence of worker crashes. Task handlers must be idempotent; do not claim exactly-once execution.

## Acceptance tests required before production

- concurrent task submissions with the same idempotency key create at most one task;
- a failed queue insert rolls back task and audit inserts;
- two workers cannot claim the same live lease;
- expired leases can be reclaimed;
- a stale lease token cannot acknowledge or release after reclaim;
- task version conflicts are detected;
- a restart preserves tasks, queue entries, audit events, checkpoints, and idempotency keys;
- migrations apply cleanly to an empty database and are safely recognized as already applied.
