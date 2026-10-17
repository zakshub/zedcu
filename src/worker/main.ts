import { randomUUID } from "node:crypto";
import { OpenAICompatibleAdapter } from "../providers/openai-compatible-adapter.js";
import { runWithFreeFallback } from "../providers/fallback-runner.js";
import type { ProviderRoute } from "../providers/types.js";
import { createPostgresPool } from "../tasks/postgres-pool.js";
import { PostgresTaskQueue } from "../tasks/postgres-task-queue.js";
import { PostgresTaskStore } from "../tasks/postgres-task-store.js";
import { TaskService } from "../tasks/task-service.js";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment setting: ${name}`);
  return value;
}

function positiveInteger(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer.`);
  return value;
}

const gatewayId = process.env.ZEDCU_GATEWAY_ID?.trim() || "openai-compatible";
const model = required("ZEDCU_MODEL");
const baseUrl = required("ZEDCU_GATEWAY_BASE_URL");
const upstreamProvider = required("ZEDCU_UPSTREAM_PROVIDER");
const evidenceUrl = required("ZEDCU_FREE_EVIDENCE_URL");
const evidenceCheckedAt = required("ZEDCU_FREE_EVIDENCE_CHECKED_AT");
const apiKey = process.env.ZEDCU_GATEWAY_API_KEY;
const confirmedFree = process.env.ZEDCU_ROUTE_CONFIRMED_FREE === "true";
const costPerMillion = process.env.ZEDCU_ROUTE_COST_USD_PER_MILLION_TOKENS;
if (costPerMillion !== "0" || !confirmedFree) {
  throw new Error(
    "Worker start blocked: set ZEDCU_ROUTE_CONFIRMED_FREE=true only after verifying the exact model's official free terms, and ZEDCU_ROUTE_COST_USD_PER_MILLION_TOKENS=0."
  );
}
const checkedDate = new Date(evidenceCheckedAt);
if (Number.isNaN(checkedDate.getTime()) || checkedDate > new Date()) {
  throw new Error("ZEDCU_FREE_EVIDENCE_CHECKED_AT must be a valid past timestamp.");
}
const parsedEvidence = new URL(evidenceUrl);
if (parsedEvidence.protocol !== "https:") throw new Error("Free-route evidence URL must use HTTPS.");

const route: ProviderRoute = {
  id: `${gatewayId}:${model}`,
  gatewayId,
  provider: upstreamProvider,
  model,
  enabled: true,
  eligibility: "verified_free",
  costUsdPerMillionTokens: 0,
  evidenceUrl,
  evidenceCheckedAt: checkedDate.toISOString(),
  capabilities: ["text"],
  priority: 1
};

const pool = createPostgresPool();
const store = new PostgresTaskStore(pool);
const queue = new PostgresTaskQueue(pool);
const service = new TaskService(store);
const adapter = new OpenAICompatibleAdapter(gatewayId, {
  baseUrl,
  ...(apiKey ? { apiKey } : {})
});
const workerId = process.env.ZEDCU_WORKER_ID?.trim() || `worker-${randomUUID()}`;
const leaseMs = positiveInteger("ZEDCU_WORKER_LEASE_MS", 60_000);
const requestTimeoutMs = Math.min(30_000, leaseMs - 5_000);
if (requestTimeoutMs < 1_000) throw new Error("Worker lease must be at least 6 seconds.");

let stopping = false;
let active = false;

async function processOne(): Promise<boolean> {
  const lease = await queue.claim(workerId, leaseMs);
  if (!lease) return false;
  const task = await store.get(lease.taskId);
  if (!task) {
    await queue.acknowledge(lease.taskId, lease.leaseToken);
    return true;
  }

  try {
    await service.apply(task.id, "start");
    await service.apply(task.id, "dispatch");
    const result = await runWithFreeFallback(
      [route],
      new Map([[gatewayId, adapter]]),
      {
        taskId: task.id,
        prompt: task.request,
        maxOutputTokens: positiveInteger("ZEDCU_MAX_OUTPUT_TOKENS", 1024),
        timeoutMs: requestTimeoutMs
      },
      { maxAttempts: 1 }
    );

    if (result.state === "completed" && result.response) {
      const output = result.response.text.slice(0, 8_000);
      await service.checkpoint(task.id, `Model output: ${output}`);
      await service.apply(task.id, "complete");
      await queue.acknowledge(lease.taskId, lease.leaseToken);
      console.info(JSON.stringify({ event: "task_completed", taskId: task.id, gatewayId, model }));
      return true;
    }

    await service.checkpoint(task.id, `Task paused by free-route policy: ${result.reason}`);
    await service.apply(task.id, "pause");
    await queue.acknowledge(lease.taskId, lease.leaseToken);
    console.warn(JSON.stringify({ event: "task_paused", taskId: task.id, reason: result.reason }));
    return true;
  } catch (error) {
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
    const didWork = await processOne();
    if (!stopping) setTimeout(() => void loop(), didWork ? 0 : 1_000);
  } catch {
    if (!stopping) setTimeout(() => void loop(), 3_000);
  } finally {
    active = false;
  }
}

console.info(JSON.stringify({ event: "worker_started", workerId, gatewayId, model }));
void loop();

async function shutdown(): Promise<void> {
  if (stopping) return;
  stopping = true;
  await pool.end();
  process.exit(0);
}
process.on("SIGTERM", () => void shutdown());
process.on("SIGINT", () => void shutdown());
