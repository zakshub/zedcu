import { describe, expect, it } from "vitest";
import { InMemoryTaskQueue, QueueConflictError } from "../src/tasks/task-queue.js";

const instant = (second: number) => new Date(Date.UTC(2026, 9, 15, 12, 0, second));

describe("InMemoryTaskQueue contract adapter", () => {
  it("makes repeated enqueue with the same key idempotent", async () => {
    const queue = new InMemoryTaskQueue();
    const first = await queue.enqueue("task-1", "request-abc", instant(0));
    const repeated = await queue.enqueue("task-1", "request-abc", instant(1));
    expect(repeated).toEqual(first);
    await expect(queue.enqueue("task-2", "request-abc", instant(2))).rejects.toThrow(QueueConflictError);
    await expect(queue.enqueue("task-1", "another-key", instant(2))).rejects.toThrow(QueueConflictError);
  });

  it("leases a task and reclaims it after expiry", async () => {
    const queue = new InMemoryTaskQueue();
    await queue.enqueue("task-1", "request-1", instant(0));
    const first = await queue.claim("worker-a", 1_000, instant(0));
    expect(first?.attempts).toBe(1);
    expect(await queue.claim("worker-b", 1_000, instant(0))).toBeNull();

    const reclaimed = await queue.claim("worker-b", 1_000, instant(2));
    expect(reclaimed?.attempts).toBe(2);
    expect(reclaimed?.workerId).toBe("worker-b");
    await expect(queue.acknowledge("task-1", first?.leaseToken ?? "")).rejects.toThrow(QueueConflictError);
    await queue.acknowledge("task-1", reclaimed?.leaseToken ?? "");
    expect(await queue.claim("worker-c", 1_000, instant(3))).toBeNull();
  });

  it("can release a lease for retry and rejects invalid lease durations", async () => {
    const queue = new InMemoryTaskQueue();
    await queue.enqueue("task-1", "request-1", instant(0));
    const lease = await queue.claim("worker-a", 1_000, instant(0));
    await queue.release("task-1", lease?.leaseToken ?? "");
    const retry = await queue.claim("worker-b", 1_000, instant(1));
    expect(retry?.attempts).toBe(2);
    await expect(queue.claim("worker-c", 0, instant(2))).rejects.toThrow("positive finite");
  });

  it("validates required identifiers", async () => {
    const queue = new InMemoryTaskQueue();
    await expect(queue.enqueue(" ", "key")).rejects.toThrow("Task ID");
    await expect(queue.enqueue("task", " ")).rejects.toThrow("Idempotency key");
    await expect(queue.claim(" ", 1000)).rejects.toThrow("Worker ID");
  });
});
