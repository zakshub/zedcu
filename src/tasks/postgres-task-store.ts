import type { TaskCheckpoint, TaskRecord, TaskStore, TaskAuditEvent } from "./task-record.js";
import { TaskConflictError } from "./json-task-store.js";
import type { TaskState } from "./task-state.js";
import type { SqlClient, SqlPool } from "./postgres-task-queue.js";

interface TaskRow {
  id: string;
  request: string;
  state: TaskState;
  created_at: Date | string;
  updated_at: Date | string;
  version: number | string;
  last_error: string | null;
}

interface CheckpointRow {
  checkpoint_number: number;
  created_at: Date | string;
  state: TaskState;
  summary: string;
  artifact_paths: string[] | unknown;
}

interface EventRow {
  sequence: number | string;
  event_type: TaskAuditEvent["type"];
  occurred_at: Date | string;
  from_state: TaskState | null;
  to_state: TaskState;
  action: NonNullable<TaskAuditEvent["action"]> | null;
  summary: string;
}

function toIso(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Database returned an invalid timestamp.");
  return date.toISOString();
}

function parseArtifactPaths(value: CheckpointRow["artifact_paths"]): string[] {
  const parsed: unknown = typeof value === "string" ? JSON.parse(value) : value;
  if (!Array.isArray(parsed) || !parsed.every((path) => typeof path === "string")) {
    throw new Error("Database returned invalid checkpoint artifact paths.");
  }
  return parsed;
}

function mapCheckpoint(row: CheckpointRow): TaskCheckpoint {
  return {
    checkpointNumber: Number(row.checkpoint_number),
    createdAt: toIso(row.created_at),
    state: row.state,
    summary: row.summary,
    artifactPaths: parseArtifactPaths(row.artifact_paths)
  };
}

function mapEvent(row: EventRow): TaskAuditEvent {
  return {
    sequence: Number(row.sequence),
    type: row.event_type,
    at: toIso(row.occurred_at),
    ...(row.from_state === null ? {} : { fromState: row.from_state }),
    toState: row.to_state,
    ...(row.action === null ? {} : { action: row.action }),
    summary: row.summary
  };
}

/**
 * Durable TaskStore adapter for PostgreSQL. Requires migration
 * 001_durable_task_queue.sql. A supplied pool is used; connection lifecycle and
 * secrets stay outside this class.
 */
export class PostgresTaskStore implements TaskStore {
  constructor(private readonly pool: SqlPool) {}

  async create(task: TaskRecord): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await this.insertTask(client, task);
      for (const checkpoint of task.checkpoints) {
        await this.insertCheckpoint(client, task.id, checkpoint);
      }
      for (const event of task.events) {
        await this.insertEvent(client, task.id, event);
      }
      await client.query("COMMIT");
    } catch (error) {
      await this.rollback(client);
      if (this.isUniqueViolation(error)) {
        throw new TaskConflictError(`Task '${task.id}' already exists or has duplicate history sequence numbers.`);
      }
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Atomically creates the task, its initial checkpoints/audit history, and its
   * durable queue row. Use this for new submissions instead of separate create()
   * and queue.enqueue() calls.
   */
  async createQueued(task: TaskRecord, idempotencyKey: string): Promise<{
    taskId: string;
    idempotencyKey: string;
    enqueuedAt: string;
    attempts: number;
  }> {
    if (!idempotencyKey.trim()) throw new Error("Idempotency key cannot be empty.");
    const client = await this.pool.connect();
    let insertingQueueRow = false;
    try {
      await client.query("BEGIN");
      const existing = await client.query<{
        task_id: string;
        idempotency_key: string;
        enqueued_at: Date | string;
        attempts: number;
      }>(
        `SELECT task_id, idempotency_key, enqueued_at, attempts
         FROM zedcu_task_queue
         WHERE task_id = $1 OR idempotency_key = $2
         FOR UPDATE`,
        [task.id, idempotencyKey]
      );
      const existingRow = existing.rows[0];
      if (existingRow) {
        if (existingRow.task_id !== task.id || existingRow.idempotency_key !== idempotencyKey) {
          throw new TaskConflictError("Task ID or idempotency key already belongs to a different submission.");
        }
        await client.query("COMMIT");
        return {
          taskId: existingRow.task_id,
          idempotencyKey: existingRow.idempotency_key,
          enqueuedAt: toIso(existingRow.enqueued_at),
          attempts: Number(existingRow.attempts)
        };
      }

      await this.insertTask(client, task);
      for (const checkpoint of task.checkpoints) {
        await this.insertCheckpoint(client, task.id, checkpoint);
      }
      for (const event of task.events) {
        await this.insertEvent(client, task.id, event);
      }

      insertingQueueRow = true;
      const queued = await client.query<{
        task_id: string;
        idempotency_key: string;
        enqueued_at: Date | string;
        attempts: number;
      }>(
        `INSERT INTO zedcu_task_queue (task_id, idempotency_key, status, enqueued_at)
         VALUES ($1, $2, 'queued', $3)
         RETURNING task_id, idempotency_key, enqueued_at, attempts`,
        [task.id, idempotencyKey, new Date(task.createdAt)]
      );
      const row = queued.rows[0];
      if (!row) throw new Error("Database did not return the created queue row.");
      await client.query("COMMIT");
      return {
        taskId: row.task_id,
        idempotencyKey: row.idempotency_key,
        enqueuedAt: toIso(row.enqueued_at),
        attempts: Number(row.attempts)
      };
    } catch (error) {
      await this.rollback(client);
      if (this.isUniqueViolation(error)) {
        if (insertingQueueRow) {
          throw new TaskConflictError("Idempotency key or task ID was concurrently submitted.");
        }
        throw new TaskConflictError(`Task '${task.id}' already exists or has duplicate history sequence numbers.`);
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async getByIdempotencyKey(idempotencyKey: string): Promise<TaskRecord | null> {
    const client = await this.pool.connect();
    try {
      const result = await client.query<{ task_id: string }>(
        "SELECT task_id FROM zedcu_task_queue WHERE idempotency_key = $1",
        [idempotencyKey]
      );
      const taskId = result.rows[0]?.task_id;
      if (!taskId) return null;
      return await this.get(taskId);
    } finally {
      client.release();
    }
  }

  async get(taskId: string): Promise<TaskRecord | null> {
    const client = await this.pool.connect();
    try {
      const taskResult = await client.query<TaskRow>(
        `SELECT id, request, state, created_at, updated_at, version, last_error
         FROM zedcu_tasks WHERE id = $1`,
        [taskId]
      );
      const row = taskResult.rows[0];
      if (!row) return null;

      const [checkpointResult, eventResult] = await Promise.all([
        client.query<CheckpointRow>(
          `SELECT checkpoint_number, created_at, state, summary, artifact_paths
           FROM zedcu_task_checkpoints WHERE task_id = $1
           ORDER BY checkpoint_number`,
          [taskId]
        ),
        client.query<EventRow>(
          `SELECT sequence, event_type, occurred_at, from_state, to_state, action, summary
           FROM zedcu_task_audit_events WHERE task_id = $1
           ORDER BY sequence`,
          [taskId]
        )
      ]);

      return {
        id: row.id,
        request: row.request,
        state: row.state,
        createdAt: toIso(row.created_at),
        updatedAt: toIso(row.updated_at),
        version: Number(row.version),
        checkpoints: checkpointResult.rows.map(mapCheckpoint),
        events: eventResult.rows.map(mapEvent),
        ...(row.last_error === null ? {} : { lastError: row.last_error })
      };
    } finally {
      client.release();
    }
  }

  async list(): Promise<TaskRecord[]> {
    const client = await this.pool.connect();
    let ids: string[];
    try {
      const result = await client.query<{ id: string }>(
        "SELECT id FROM zedcu_tasks ORDER BY created_at, id"
      );
      ids = result.rows.map((row) => row.id);
    } finally {
      client.release();
    }
    const tasks = await Promise.all(ids.map((id) => this.get(id)));
    return tasks.filter((task): task is TaskRecord => task !== null);
  }

  async save(task: TaskRecord, expectedVersion: number): Promise<void> {
    if (task.version !== expectedVersion + 1) {
      throw new TaskConflictError("Updated task version must increment by exactly one.");
    }

    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const updated = await client.query<{ id: string }>(
        `UPDATE zedcu_tasks
         SET request = $3, state = $4, updated_at = $5, version = $6, last_error = $7
         WHERE id = $1 AND version = $2
         RETURNING id`,
        [
          task.id,
          expectedVersion,
          task.request,
          task.state,
          new Date(task.updatedAt),
          task.version,
          task.lastError ?? null
        ]
      );
      if (updated.rowCount !== 1) {
        throw new TaskConflictError(
          `Task '${task.id}' is missing or its version no longer matches ${expectedVersion}.`
        );
      }

      const [checkpointMax, eventMax] = await Promise.all([
        client.query<{ max_sequence: number | string | null }>(
          "SELECT MAX(checkpoint_number) AS max_sequence FROM zedcu_task_checkpoints WHERE task_id = $1",
          [task.id]
        ),
        client.query<{ max_sequence: number | string | null }>(
          "SELECT MAX(sequence) AS max_sequence FROM zedcu_task_audit_events WHERE task_id = $1",
          [task.id]
        )
      ]);
      const lastCheckpoint = Number(checkpointMax.rows[0]?.max_sequence ?? 0);
      const lastEvent = Number(eventMax.rows[0]?.max_sequence ?? 0);

      for (const checkpoint of task.checkpoints) {
        if (checkpoint.checkpointNumber > lastCheckpoint) {
          await this.insertCheckpoint(client, task.id, checkpoint);
        }
      }
      for (const event of task.events) {
        if (event.sequence > lastEvent) await this.insertEvent(client, task.id, event);
      }
      await client.query("COMMIT");
    } catch (error) {
      await this.rollback(client);
      if (this.isUniqueViolation(error)) {
        throw new TaskConflictError("Task history sequence conflicts with data already stored.");
      }
      throw error;
    } finally {
      client.release();
    }
  }

  private async insertTask(client: SqlClient, task: TaskRecord): Promise<void> {
    await client.query(
      `INSERT INTO zedcu_tasks
        (id, request, state, created_at, updated_at, version, last_error)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        task.id,
        task.request,
        task.state,
        new Date(task.createdAt),
        new Date(task.updatedAt),
        task.version,
        task.lastError ?? null
      ]
    );
  }

  private async insertCheckpoint(
    client: SqlClient,
    taskId: string,
    checkpoint: TaskCheckpoint
  ): Promise<void> {
    await client.query(
      `INSERT INTO zedcu_task_checkpoints
        (task_id, checkpoint_number, created_at, state, summary, artifact_paths)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
      [
        taskId,
        checkpoint.checkpointNumber,
        new Date(checkpoint.createdAt),
        checkpoint.state,
        checkpoint.summary,
        JSON.stringify(checkpoint.artifactPaths)
      ]
    );
  }

  private async insertEvent(
    client: SqlClient,
    taskId: string,
    event: TaskAuditEvent
  ): Promise<void> {
    await client.query(
      `INSERT INTO zedcu_task_audit_events
        (task_id, sequence, event_type, occurred_at, from_state, to_state, action, summary)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        taskId,
        event.sequence,
        event.type,
        new Date(event.at),
        event.fromState ?? null,
        event.toState,
        event.action ?? null,
        event.summary
      ]
    );
  }

  private async rollback(client: SqlClient): Promise<void> {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Preserve the original error; the caller still releases the connection.
    }
  }

  private isUniqueViolation(error: unknown): boolean {
    return typeof error === "object" && error !== null && "code" in error &&
      (error as { code?: unknown }).code === "23505";
  }
}
