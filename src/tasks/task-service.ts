import { randomUUID } from "node:crypto";
import type { TaskCheckpoint, TaskRecord, TaskStore } from "./task-record.js";
import { transitionTask, type TaskEvent } from "./task-state.js";

export class TaskNotFoundError extends Error {
  constructor(taskId: string) {
    super(`Task '${taskId}' was not found.`);
    this.name = "TaskNotFoundError";
  }
}

export interface TaskServiceOptions {
  now?: () => Date;
  createId?: () => string;
}

interface AtomicTaskSubmissionStore extends TaskStore {
  createQueued(
    task: TaskRecord,
    idempotencyKey: string
  ): Promise<{
    taskId: string;
    idempotencyKey: string;
    enqueuedAt: string;
    attempts: number;
  }>;
}

export class TaskService {
  private readonly now: () => Date;
  private readonly createId: () => string;

  constructor(private readonly store: TaskStore, options: TaskServiceOptions = {}) {
    this.now = options.now ?? (() => new Date());
    this.createId = options.createId ?? randomUUID;
  }

  async create(request: string): Promise<TaskRecord> {
    const task = this.newRecord(request);
    await this.store.create(task);
    return task;
  }

  /**
   * Submit a task and enqueue it atomically. This requires a store such as
   * PostgresTaskStore that implements createQueued(); JSON/test stores fail
   * closed rather than creating a task that has no queue entry.
   */
  async submit(request: string, idempotencyKey: string): Promise<TaskRecord> {
    if (!idempotencyKey.trim()) throw new Error("Idempotency key cannot be empty.");
    if (typeof (this.store as Partial<AtomicTaskSubmissionStore>).createQueued !== "function") {
      throw new Error("Task store does not support atomic submission; use a PostgreSQL TaskStore.");
    }
    const atomicStore = this.store as AtomicTaskSubmissionStore;
    const task = this.newRecord(request);
    await atomicStore.createQueued(task, idempotencyKey.trim());
    return task;
  }

  async apply(taskId: string, event: TaskEvent): Promise<TaskRecord> {
    const current = await this.store.get(taskId);
    if (!current) throw new TaskNotFoundError(taskId);
    const nextState = transitionTask(current.state, event);
    const now = this.now().toISOString();
    const updated: TaskRecord = {
      ...current,
      state: nextState,
      updatedAt: now,
      version: current.version + 1,
      events: [...current.events, {
        sequence: current.events.length + 1,
        type: "state_transition",
        at: now,
        fromState: current.state,
        toState: nextState,
        action: event,
        summary: `State changed from ${current.state} to ${nextState}.`
      }]
    };
    await this.store.save(updated, current.version);
    return updated;
  }

  async checkpoint(taskId: string, summary: string, artifactPaths: string[] = []): Promise<TaskRecord> {
    if (!summary.trim()) throw new Error("Checkpoint summary cannot be empty.");
    const current = await this.store.get(taskId);
    if (!current) throw new TaskNotFoundError(taskId);
    if (current.state === "completed" || current.state === "cancelled") {
      throw new Error(`Cannot checkpoint a task in terminal state '${current.state}'.`);
    }
    const now = this.now().toISOString();
    const checkpoint: TaskCheckpoint = {
      checkpointNumber: (current.checkpoints.at(-1)?.checkpointNumber ?? 0) + 1,
      createdAt: now,
      state: current.state,
      summary: summary.trim(),
      artifactPaths: [...artifactPaths]
    };
    const updated: TaskRecord = {
      ...current,
      updatedAt: now,
      version: current.version + 1,
      checkpoints: [...current.checkpoints, checkpoint],
      events: [...current.events, {
        sequence: current.events.length + 1,
        type: "checkpoint_created",
        at: now,
        toState: current.state,
        summary: `Checkpoint ${checkpoint.checkpointNumber} created: ${summary.trim()}`
      }]
    };
    await this.store.save(updated, current.version);
    return updated;
  }

  private newRecord(request: string): TaskRecord {
    if (!request.trim()) throw new Error("Task request cannot be empty.");
    const now = this.now().toISOString();
    return {
      id: this.createId(),
      request: request.trim(),
      state: "queued",
      createdAt: now,
      updatedAt: now,
      version: 1,
      checkpoints: [],
      events: [{
        sequence: 1,
        type: "created",
        at: now,
        toState: "queued",
        summary: "Task created."
      }]
    };
  }
}
