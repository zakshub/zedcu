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

export class TaskService {
  private readonly now: () => Date;
  private readonly createId: () => string;

  constructor(private readonly store: TaskStore, options: TaskServiceOptions = {}) {
    this.now = options.now ?? (() => new Date());
    this.createId = options.createId ?? randomUUID;
  }

  async create(request: string): Promise<TaskRecord> {
    if (!request.trim()) throw new Error("Task request cannot be empty.");
    const now = this.now().toISOString();
    const task: TaskRecord = {
      id: this.createId(),
      request: request.trim(),
      state: "queued",
      createdAt: now,
      updatedAt: now,
      version: 1,
      checkpoints: [],
      events: [{ sequence: 1, type: "created", at: now, toState: "queued", summary: "Task created." }]
    };
    await this.store.create(task);
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
}
