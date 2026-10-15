export interface QueueMessage {
  taskId: string;
  idempotencyKey: string;
  enqueuedAt: string;
  attempts: number;
}

export interface QueueLease extends QueueMessage {
  workerId: string;
  leaseToken: string;
  leaseExpiresAt: string;
}

export interface TaskQueue {
  enqueue(taskId: string, idempotencyKey: string, now?: Date): Promise<QueueMessage>;
  claim(workerId: string, leaseMilliseconds: number, now?: Date): Promise<QueueLease | null>;
  acknowledge(taskId: string, leaseToken: string, now?: Date): Promise<void>;
  release(taskId: string, leaseToken: string, now?: Date): Promise<void>;
}

export class QueueConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QueueConflictError";
  }
}

interface QueueEntry extends QueueMessage {
  status: "queued" | "leased" | "acknowledged";
  workerId?: string;
  leaseToken?: string;
  leaseExpiresAt?: string;
}

/**
 * In-memory contract/test adapter only. State is lost on process restart and
 * it is not safe for multiple processes. Production needs atomic DB/queue ops.
 */
export class InMemoryTaskQueue implements TaskQueue {
  private readonly entries = new Map<string, QueueEntry>();
  private readonly idempotency = new Map<string, string>();
  private sequence = 0;

  async enqueue(taskId: string, idempotencyKey: string, now = new Date()): Promise<QueueMessage> {
    if (!taskId.trim()) throw new Error("Task ID cannot be empty.");
    if (!idempotencyKey.trim()) throw new Error("Idempotency key cannot be empty.");
    const existingTaskId = this.idempotency.get(idempotencyKey);
    if (existingTaskId) {
      if (existingTaskId !== taskId) {
        throw new QueueConflictError("Idempotency key is already assigned to another task.");
      }
      const existing = this.entries.get(taskId);
      if (!existing) throw new QueueConflictError("Idempotency index points to a missing queue entry.");
      return this.toMessage(existing);
    }
    if (this.entries.has(taskId)) throw new QueueConflictError(`Task '${taskId}' is already enqueued with a different idempotency key.`);
    const entry: QueueEntry = {
      taskId,
      idempotencyKey,
      enqueuedAt: now.toISOString(),
      attempts: 0,
      status: "queued"
    };
    this.entries.set(taskId, entry);
    this.idempotency.set(idempotencyKey, taskId);
    return this.toMessage(entry);
  }

  async claim(workerId: string, leaseMilliseconds: number, now = new Date()): Promise<QueueLease | null> {
    if (!workerId.trim()) throw new Error("Worker ID cannot be empty.");
    if (!Number.isFinite(leaseMilliseconds) || leaseMilliseconds <= 0) {
      throw new Error("Lease duration must be a positive finite number.");
    }
    const nowMs = now.getTime();
    const available = [...this.entries.values()]
      .filter((entry) => entry.status === "queued" ||
        (entry.status === "leased" && Date.parse(entry.leaseExpiresAt ?? "") <= nowMs))
      .sort((a, b) => a.enqueuedAt.localeCompare(b.enqueuedAt) || a.taskId.localeCompare(b.taskId));
    const entry = available[0];
    if (!entry) return null;

    this.sequence += 1;
    entry.status = "leased";
    entry.attempts += 1;
    entry.workerId = workerId;
    entry.leaseToken = `lease-${this.sequence}`;
    entry.leaseExpiresAt = new Date(nowMs + leaseMilliseconds).toISOString();
    return {
      ...this.toMessage(entry),
      workerId,
      leaseToken: entry.leaseToken,
      leaseExpiresAt: entry.leaseExpiresAt
    };
  }

  async acknowledge(taskId: string, leaseToken: string, now = new Date()): Promise<void> {
    const entry = this.requireActiveLease(taskId, leaseToken, now);
    entry.status = "acknowledged";
    delete entry.workerId;
    delete entry.leaseToken;
    delete entry.leaseExpiresAt;
  }

  async release(taskId: string, leaseToken: string, now = new Date()): Promise<void> {
    const entry = this.requireActiveLease(taskId, leaseToken, now);
    entry.status = "queued";
    delete entry.workerId;
    delete entry.leaseToken;
    delete entry.leaseExpiresAt;
  }

  private requireActiveLease(taskId: string, leaseToken: string, now: Date): QueueEntry {
    const entry = this.entries.get(taskId);
    if (!entry || entry.status !== "leased" || entry.leaseToken !== leaseToken || Date.parse(entry.leaseExpiresAt ?? "") <= now.getTime()) {
      throw new QueueConflictError("Task lease is missing, expired, or owned by another claim.");
    }
    return entry;
  }

  private toMessage(entry: QueueEntry): QueueMessage {
    return {
      taskId: entry.taskId,
      idempotencyKey: entry.idempotencyKey,
      enqueuedAt: entry.enqueuedAt,
      attempts: entry.attempts
    };
  }
}
