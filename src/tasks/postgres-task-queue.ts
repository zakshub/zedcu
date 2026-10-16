import type { QueueLease, QueueMessage, TaskQueue } from "./task-queue.js";
import { QueueConflictError } from "./task-queue.js";

/**
 * Minimal structural interfaces compatible with node-postgres Pool/PoolClient.
 * The application supplies a configured pool; this module does not create a
 * connection or read credentials from the environment.
 */
export interface SqlQueryResult<Row> {
  rows: Row[];
  rowCount: number | null;
}

export interface SqlClient {
  query<Row = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[]
  ): Promise<SqlQueryResult<Row>>;
  release(): void;
}

export interface SqlPool {
  connect(): Promise<SqlClient>;
}

interface QueueRow {
  task_id: string;
  idempotency_key: string;
  enqueued_at: Date | string;
  attempts: number;
  status: "queued" | "leased" | "acknowledged";
  worker_id: string | null;
  lease_token: string | null;
  lease_expires_at: Date | string | null;
}

function iso(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Database returned an invalid timestamp.");
  return date.toISOString();
}

function toMessage(row: QueueRow): QueueMessage {
  return {
    taskId: row.task_id,
    idempotencyKey: row.idempotency_key,
    enqueuedAt: iso(row.enqueued_at),
    attempts: Number(row.attempts)
  };
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error &&
    (error as { code?: unknown }).code === "23505";
}

/**
 * PostgreSQL-backed durable queue.
 *
 * The supplied pool must target a database where migrations/001_durable_task_queue.sql
 * has been applied. enqueue() requires the referenced task to exist first.
 * Create-task + enqueue + audit-event atomicity belongs in a task submission
 * service that performs all three writes on one transaction/client.
 */
export class PostgresTaskQueue implements TaskQueue {
  constructor(private readonly pool: SqlPool) {}

  async enqueue(taskId: string, idempotencyKey: string, now = new Date()): Promise<QueueMessage> {
    if (!taskId.trim()) throw new Error("Task ID cannot be empty.");
    if (!idempotencyKey.trim()) throw new Error("Idempotency key cannot be empty.");
    if (Number.isNaN(now.getTime())) throw new Error("Enqueue timestamp is invalid.");

    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const existing = await client.query<QueueRow>(
        `SELECT task_id, idempotency_key, enqueued_at, attempts, status,
                worker_id, lease_token, lease_expires_at
         FROM zedcu_task_queue
         WHERE task_id = $1 OR idempotency_key = $2
         FOR UPDATE`,
        [taskId, idempotencyKey]
      );
      if (existing.rows.length > 0) {
        const row = existing.rows[0];
        if (!row || row.task_id !== taskId || row.idempotency_key !== idempotencyKey) {
          throw new QueueConflictError("Task or idempotency key is already assigned to a different queue entry.");
        }
        await client.query("COMMIT");
        return toMessage(row);
      }

      const inserted = await client.query<QueueRow>(
        `INSERT INTO zedcu_task_queue (task_id, idempotency_key, status, enqueued_at)
         VALUES ($1, $2, 'queued', $3)
         RETURNING task_id, idempotency_key, enqueued_at, attempts, status,
                   worker_id, lease_token, lease_expires_at`,
        [taskId, idempotencyKey, now]
      );
      const row = inserted.rows[0];
      if (!row) throw new Error("Database did not return the inserted queue entry.");
      await client.query("COMMIT");
      return toMessage(row);
    } catch (error) {
      await this.rollback(client);
      if (isUniqueViolation(error)) {
        throw new QueueConflictError("Task or idempotency key was concurrently assigned to another queue entry.");
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async claim(workerId: string, leaseMilliseconds: number, now = new Date()): Promise<QueueLease | null> {
    if (!workerId.trim()) throw new Error("Worker ID cannot be empty.");
    if (!Number.isFinite(leaseMilliseconds) || leaseMilliseconds <= 0) {
      throw new Error("Lease duration must be a positive finite number.");
    }
    if (Number.isNaN(now.getTime())) throw new Error("Claim timestamp is invalid.");

    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const selected = await client.query<QueueRow>(
        `SELECT task_id, idempotency_key, enqueued_at, attempts, status,
                worker_id, lease_token, lease_expires_at
         FROM zedcu_task_queue
         WHERE status = 'queued'
            OR (status = 'leased' AND lease_expires_at <= $1)
         ORDER BY enqueued_at, task_id
         FOR UPDATE SKIP LOCKED
         LIMIT 1`,
        [now]
      );
      const row = selected.rows[0];
      if (!row) {
        await client.query("COMMIT");
        return null;
      }

      const updated = await client.query<QueueRow>(
        `UPDATE zedcu_task_queue
         SET status = 'leased',
             worker_id = $2,
             lease_token = gen_random_uuid(),
             lease_expires_at = $3,
             attempts = attempts + 1
         WHERE task_id = $1
         RETURNING task_id, idempotency_key, enqueued_at, attempts, status,
                   worker_id, lease_token, lease_expires_at`,
        [row.task_id, workerId, new Date(now.getTime() + leaseMilliseconds)]
      );
      const leased = updated.rows[0];
      if (!leased?.lease_token || !leased.lease_expires_at || !leased.worker_id) {
        throw new Error("Database did not return complete lease ownership fields.");
      }
      await client.query("COMMIT");
      return {
        ...toMessage(leased),
        workerId: leased.worker_id,
        leaseToken: leased.lease_token,
        leaseExpiresAt: iso(leased.lease_expires_at)
      };
    } catch (error) {
      await this.rollback(client);
      throw error;
    } finally {
      client.release();
    }
  }

  async acknowledge(taskId: string, leaseToken: string, now = new Date()): Promise<void> {
    await this.finishLease(taskId, leaseToken, now, "acknowledged");
  }

  async release(taskId: string, leaseToken: string, now = new Date()): Promise<void> {
    await this.finishLease(taskId, leaseToken, now, "queued");
  }

  private async finishLease(
    taskId: string,
    leaseToken: string,
    now: Date,
    nextStatus: "queued" | "acknowledged"
  ): Promise<void> {
    if (!taskId.trim()) throw new Error("Task ID cannot be empty.");
    if (!leaseToken.trim()) throw new Error("Lease token cannot be empty.");
    if (Number.isNaN(now.getTime())) throw new Error("Lease operation timestamp is invalid.");

    const client = await this.pool.connect();
    try {
      const result = await client.query(
        `UPDATE zedcu_task_queue
         SET status = $4,
             worker_id = NULL,
             lease_token = NULL,
             lease_expires_at = NULL
         WHERE task_id = $1
           AND status = 'leased'
           AND lease_token = $2
           AND lease_expires_at > $3`,
        [taskId, leaseToken, now, nextStatus]
      );
      if (result.rowCount !== 1) {
        throw new QueueConflictError("Task lease is missing, expired, or owned by another claim.");
      }
    } finally {
      client.release();
    }
  }

  private async rollback(client: SqlClient): Promise<void> {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Preserve the original operation error; connection is released by caller.
    }
  }
}
