import { afterAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { PostgresTaskQueue } from "../src/tasks/postgres-task-queue.js";
import { PostgresTaskStore } from "../src/tasks/postgres-task-store.js";
import { QueueConflictError } from "../src/tasks/task-queue.js";
import { TaskConflictError } from "../src/tasks/json-task-store.js";
import type { TaskRecord } from "../src/tasks/task-record.js";

const pool = new Pool();
const store = new PostgresTaskStore(pool);
const queue = new PostgresTaskQueue(pool);
const createdTaskIds: string[] = [];

function newTask(id = randomUUID()): TaskRecord {
  createdTaskIds.push(id);
  const at = new Date().toISOString();
  return {
    id,
    request: "PostgreSQL integration test task",
    state: "queued",
    createdAt: at,
    updatedAt: at,
    version: 0,
    checkpoints: [],
    events: [
      {
        sequence: 1,
        type: "created",
        at,
        toState: "queued",
        summary: "Task created for integration test"
      }
    ]
  };
}

describe("PostgreSQL persistence integration", () => {
  afterAll(async () => {
    if (createdTaskIds.length > 0) {
      await pool.query("DELETE FROM zedcu_tasks WHERE id = ANY($1::text[])", [createdTaskIds]);
    }
    await pool.end();
  });

  it("persists and reloads a queued task and its audit history", async () => {
    const task = newTask();
    const queued = await store.createQueued(task, randomUUID());
    const loaded = await store.get(task.id);

    expect(queued.taskId).toBe(task.id);
    expect(loaded).toMatchObject({
      id: task.id,
      request: task.request,
      state: "queued",
      version: 0,
      events: [{ sequence: 1, type: "created", toState: "queued" }]
    });

    const lease = await queue.claim("integration-worker-persist", 30_000);
    expect(lease?.taskId).toBe(task.id);
    await queue.acknowledge(task.id, lease?.leaseToken ?? "");
  });

  it("rolls back task creation if its audit history violates a database constraint", async () => {
    const task = newTask();
    task.events.push({ ...task.events[0]!, summary: "duplicate sequence" });

    await expect(store.createQueued(task, randomUUID())).rejects.toThrow(TaskConflictError);
    expect(await store.get(task.id)).toBeNull();
  });

  it("claims different queue rows concurrently and acknowledges the leases", async () => {
    const first = newTask();
    const second = newTask();
    await store.createQueued(first, randomUUID());
    await store.createQueued(second, randomUUID());

    const leases = await Promise.all([
      queue.claim("integration-worker-a", 30_000),
      queue.claim("integration-worker-b", 30_000)
    ]);
    const claimedIds = leases.filter((lease) => lease !== null).map((lease) => lease.taskId);

    expect(claimedIds).toHaveLength(2);
    expect(new Set(claimedIds).size).toBe(2);

    for (const lease of leases) {
      if (lease) await queue.acknowledge(lease.taskId, lease.leaseToken);
    }
  });

  it("reclaims an expired lease and rejects the stale token", async () => {
    const task = newTask();
    await store.createQueued(task, randomUUID());

    const first = await queue.claim("integration-worker-old", 5);
    expect(first?.taskId).toBe(task.id);
    await new Promise((resolve) => setTimeout(resolve, 30));

    const reclaimed = await queue.claim("integration-worker-new", 30_000);
    expect(reclaimed?.taskId).toBe(task.id);
    expect(reclaimed?.attempts).toBe(2);
    expect(reclaimed?.leaseToken).not.toBe(first?.leaseToken);
    await expect(
      queue.acknowledge(task.id, first?.leaseToken ?? "")
    ).rejects.toThrow(QueueConflictError);
    await queue.acknowledge(task.id, reclaimed?.leaseToken ?? "");
  });
});
