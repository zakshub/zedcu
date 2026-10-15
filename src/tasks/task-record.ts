import type { TaskState } from "./task-state.js";

export interface TaskCheckpoint {
  checkpointNumber: number;
  createdAt: string;
  state: TaskState;
  summary: string;
  artifactPaths: string[];
}

export interface TaskRecord {
  id: string;
  request: string;
  state: TaskState;
  createdAt: string;
  updatedAt: string;
  version: number;
  checkpoints: TaskCheckpoint[];
  lastError?: string;
}

export interface TaskStore {
  create(task: TaskRecord): Promise<void>;
  get(taskId: string): Promise<TaskRecord | null>;
  list(): Promise<TaskRecord[]>;
  save(task: TaskRecord, expectedVersion: number): Promise<void>;
}
