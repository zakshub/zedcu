import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { TaskRecord, TaskStore } from "./task-record.js";

interface StoreDocument {
  schemaVersion: 1;
  tasks: Record<string, TaskRecord>;
}

export class TaskConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TaskConflictError";
  }
}

/**
 * Single-process JSON store for development and recovery tests.
 * Do not share this file across multiple workers or network filesystems;
 * production should implement TaskStore with a transactional database.
 */
export class JsonTaskStore implements TaskStore {
  private writeChain: Promise<void> = Promise.resolve();
  private readonly filePath: string;

  constructor(filePath: string) {
    this.filePath = resolve(filePath);
  }

  private async readDocument(): Promise<StoreDocument> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      const parsed: unknown = JSON.parse(raw);
      if (!isStoreDocument(parsed)) throw new Error("Task store has an unsupported or invalid format.");
      return parsed;
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") {
        return { schemaVersion: 1, tasks: {} };
      }
      throw error;
    }
  }

  private async writeDocument(document: StoreDocument): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.tmp`;
    await writeFile(temporaryPath, JSON.stringify(document, null, 2), { encoding: "utf8", mode: 0o600 });
    await rename(temporaryPath, this.filePath);
  }

  private async serialized<T>(operation: () => Promise<T>): Promise<T> {
    let release!: () => void;
    const previous = this.writeChain;
    this.writeChain = new Promise<void>((resolveChain) => { release = resolveChain; });
    await previous;
    try {
      return await operation();
    } finally {
      release();
    }
  }

  async create(task: TaskRecord): Promise<void> {
    await this.serialized(async () => {
      const document = await this.readDocument();
      if (document.tasks[task.id]) throw new TaskConflictError(`Task '${task.id}' already exists.`);
      document.tasks[task.id] = structuredClone(task);
      await this.writeDocument(document);
    });
  }

  async get(taskId: string): Promise<TaskRecord | null> {
    await this.writeChain;
    const document = await this.readDocument();
    const task = document.tasks[taskId];
    return task ? structuredClone(task) : null;
  }

  async list(): Promise<TaskRecord[]> {
    await this.writeChain;
    const document = await this.readDocument();
    return Object.values(document.tasks).map((task) => structuredClone(task));
  }

  async save(task: TaskRecord, expectedVersion: number): Promise<void> {
    await this.serialized(async () => {
      const document = await this.readDocument();
      const current = document.tasks[task.id];
      if (!current) throw new TaskConflictError(`Task '${task.id}' does not exist.`);
      if (current.version !== expectedVersion) {
        throw new TaskConflictError(
          `Task '${task.id}' version conflict: expected ${expectedVersion}, found ${current.version}.`
        );
      }
      if (task.version !== expectedVersion + 1) {
        throw new TaskConflictError("Updated task version must increment by exactly one.");
      }
      if (task.id !== current.id || task.createdAt !== current.createdAt) {
        throw new TaskConflictError("Task ID and creation time are immutable.");
      }
      document.tasks[task.id] = structuredClone(task);
      await this.writeDocument(document);
    });
  }
}

function isStoreDocument(value: unknown): value is StoreDocument {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<StoreDocument>;
  return candidate.schemaVersion === 1 &&
    typeof candidate.tasks === "object" &&
    candidate.tasks !== null &&
    !Array.isArray(candidate.tasks);
}
