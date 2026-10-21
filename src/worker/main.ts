import { randomUUID } from "node:crypto";
import { runWithFreeFallback } from "../providers/fallback-runner.js";
import { createPostgresPool } from "../tasks/postgres-pool.js";
import { PostgresTaskQueue } from "../tasks/postgres-task-queue.js";
import { PostgresTaskStore } from "../tasks/postgres-task-store.js";
import { TaskService } from "../tasks/task-service.js";
import { buildWorkerRoutes, parseWorkerRouteConfig } from "./route-config.js";
import { watchTaskCancellation } from "./task-cancellation.js";

function positiveInteger(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer.`);
  return value;
}

const { routes, adapters } = buildWorkerRoutes(parseWorkerRouteConfig());
const pool = createPostgresPool();
const store = new PostgresTaskStore(pool);
const queue = new PostgresTaskQueue(pool);
const service = new TaskService(store);
const workerId = process.env.ZEDCU_WORKER_ID?.trim() || `worker-${randomUUID()}`;
const leaseMs = positiveInteger("ZEDCU_WORKER_LEASE_MS", 60_000);
const requestTimeoutMs = Math.min(30_000, leaseMs - 5_000);
if (requestTimeoutMs < 1_000) throw new Error("Worker lease must be at least 6 seconds.");

let stopping = false;
let active = false;
let currentWork: Promise<boolean> | undefined;

async function processOne(): Promise<boolean> {
  const lease = await queue.claim(workerId, leaseMs);
  if (!lease) return false;
  const task = await store.get(lease.taskId);
  if (!task) {
    await queue.acknowledge(lease.taskId, lease.leaseToken);
    return true;
  }

  // A previous worker may have died after changing the task state but before
  // acknowledging its queue lease. Recover interrupted work instead of trying
  // to apply "start" to a task that is already planning/running.
  if (task.state === "planning" || task.state === "running" || task.state === "failed") {
    if (task.state === "planning" || task.state === "running") {
      await service.apply(task.id, "fail");
    }
    await service.apply(task.id, "resume");
    console.warn(JSON.stringify({
      event: "interrupted_task_requeued",
      taskId: task.id,
      previousState: task.state,
      queueAttempt: lease.attempts
    }));
    // resume() atomically clears the old lease and requeues the task. Let the
    // next poll claim it afresh, so no stale lease token is acknowledged here.
    return true;
  }

  if (task.state !== "queued") {
    // Paused, awaiting approval, and terminal tasks are not executable.
    await queue.acknowledge(lease.taskId, lease.leaseToken);
    console.info(JSON.stringify({
      event: "non_runnable_task_acknowledged",
      taskId: task.id,
      state: task.state
    }));
    return true;
  }

  let stopCancellationWatch: (() => void) | undefined;
  try {
    await service.apply(task.id, "start");
    await service.apply(task.id, "dispatch");
    const requestController = new AbortController();
    stopCancellationWatch = watchTaskCancellation(async () => {
      const latest = await store.get(task.id);
      return latest?.state ?? null;
    }, requestController);
    const result = await runWithFreeFallback(
      routes,
      adapters,
      {
        taskId: task.id,
        prompt: task.request,
        maxOutputTokens: positiveInteger("ZEDCU_MAX_OUTPUT_TOKENS", 1024),
        timeoutMs: requestTimeoutMs,
        signal: requestController.signal
      },
      { maxAttempts: routes.length }
    );
    stopCancellationWatch();
    stopCancellationWatch = undefined;

    const latestTask = await store.get(task.id);
    if (!latestTask || latestTask.state !== "running") {
      await queue.acknowledge(lease.taskId, lease.leaseToken);
      console.info(JSON.stringify({
        event: "task_execution_stopped_by_state_change",
        taskId: task.id,
        state: latestTask?.state ?? "missing"
      }));
      return true;
    }

    if (result.state === "completed" && result.response) {
      const output = result.response.text.slice(0, 8_000);
      await service.checkpoint(task.id, `Model output: ${output}`);
      await service.apply(task.id, "complete");
      await queue.acknowledge(lease.taskId, lease.leaseToken);
      console.info(JSON.stringify({
        event: "task_completed", taskId: task.id,
        gatewayId: result.attempts.find((attempt) => attempt.outcome === "success")?.gatewayId,
        model: result.attempts.find((attempt) => attempt.outcome === "success")?.model,
        attemptedRoutes: result.attempts.length
      }));
      return true;
    }

    await service.checkpoint(task.id, `Task paused by free-route policy: ${result.reason}`);
    await service.apply(task.id, "pause");
    await queue.acknowledge(lease.taskId, lease.leaseToken);
    console.warn(JSON.stringify({ event: "task_paused", taskId: task.id, reason: result.reason }));
    return true;
  } catch (error) {
    stopCancellationWatch?.();
    try {
      const current = await store.get(task.id);
      if (current && (current.state === "planning" || current.state === "running")) {
        await service.apply(task.id, "fail");
      }
    } catch {
      // Preserve the original failure; the queue lease will expire if ack fails.
    }
    try {
      await queue.acknowledge(lease.taskId, lease.leaseToken);
    } catch {
      // Lease expiry/reclaim remains the recovery path.
    }
    console.error(JSON.stringify({
      event: "task_failed",
      taskId: task.id,
      error: error instanceof Error ? error.message : "unknown_error"
    }));
    return true;
  }
}

async function loop(): Promise<void> {
  if (stopping || active) return;
  active = true;
  try {
    currentWork = processOne();
    const didWork = await currentWork;
    currentWork = undefined;
    if (!stopping) setTimeout(() => void loop(), didWork ? 0 : 1_000);
  } catch {
    currentWork = undefined;
    if (!stopping) setTimeout(() => void loop(), 3_000);
  } finally {
    active = false;
  }
}

console.info(JSON.stringify({ event: "worker_started", workerId, routes: routes.map(({ id, gatewayId, provider, model }) => ({ id, gatewayId, provider, model })) }));
void loop();

async function shutdown(): Promise<void> {
  if (stopping) return;
  stopping = true;
  if (currentWork) await currentWork.catch(() => false);
  await pool.end();
  process.exit(0);
}
process.on("SIGTERM", () => void shutdown());
process.on("SIGINT", () => void shutdown());
