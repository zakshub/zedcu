import { randomUUID } from "node:crypto";
import { OpenAICompatibleAdapter } from "../providers/openai-compatible-adapter.js";
import { runWithFreeFallback } from "../providers/fallback-runner.js";
import type { ProviderRoute } from "../providers/types.js";
import { createPostgresPool } from "../tasks/postgres-pool.js";
import { PostgresTaskQueue } from "../tasks/postgres-task-queue.js";
import { PostgresTaskStore } from "../tasks/postgres-task-store.js";
import { TaskService } from "../tasks/task-service.js";

interface RouteConfig {
  id: string;
  gatewayId: string;
  provider: string;
  model: string;
  baseUrlEnv: string;
  apiKeyEnv?: string;
  evidenceUrl: string;
  evidenceCheckedAt: string;
  confirmedFree: boolean;
  costUsdPerMillionTokens: number;
  enabled?: boolean;
  priority?: number;
  capabilities?: string[];
}

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

function parseRouteConfig(): RouteConfig[] {
  const raw = process.env.ZEDCU_ROUTES_JSON;
  if (raw?.trim()) {
    let value: unknown;
    try {
      value = JSON.parse(raw);
    } catch {
      throw new Error("ZEDCU_ROUTES_JSON must be valid JSON.");
    }
    if (!Array.isArray(value) || value.length === 0 || value.length > 25) {
      throw new Error("ZEDCU_ROUTES_JSON must be an array containing 1 to 25 route definitions.");
    }
    return value as RouteConfig[];
  }

  // Single-route compatibility mode; all secrets remain in separate environment variables.
  return [{
    id: `${process.env.ZEDCU_GATEWAY_ID?.trim() || "openai-compatible"}:${required("ZEDCU_MODEL")}`,
    gatewayId: process.env.ZEDCU_GATEWAY_ID?.trim() || "openai-compatible",
    provider: required("ZEDCU_UPSTREAM_PROVIDER"),
    model: required("ZEDCU_MODEL"),
    baseUrlEnv: "ZEDCU_GATEWAY_BASE_URL",
    apiKeyEnv: "ZEDCU_GATEWAY_API_KEY",
    evidenceUrl: required("ZEDCU_FREE_EVIDENCE_URL"),
    evidenceCheckedAt: required("ZEDCU_FREE_EVIDENCE_CHECKED_AT"),
    confirmedFree: process.env.ZEDCU_ROUTE_CONFIRMED_FREE === "true",
    costUsdPerMillionTokens: Number(process.env.ZEDCU_ROUTE_COST_USD_PER_MILLION_TOKENS)
  }];
}

function buildRoutes(configs: RouteConfig[]): { routes: ProviderRoute[]; adapters: Map<string, OpenAICompatibleAdapter> } {
  const routes: ProviderRoute[] = [];
  const adapters = new Map<string, OpenAICompatibleAdapter>();
  const adapterConfig = new Map<string, { baseUrl: string; apiKey?: string }>();
  const routeIds = new Set<string>();

  for (const config of configs) {
    if (!config || typeof config !== "object" || typeof config.id !== "string" ||
        typeof config.gatewayId !== "string" || typeof config.provider !== "string" ||
        typeof config.model !== "string" || typeof config.baseUrlEnv !== "string" ||
        typeof config.evidenceUrl !== "string" || typeof config.evidenceCheckedAt !== "string") {
      throw new Error("Each route must define id, gatewayId, provider, model, baseUrlEnv, evidenceUrl, and evidenceCheckedAt.");
    }
    if (config.enabled === false) continue;
    if (!config.confirmedFree || config.costUsdPerMillionTokens !== 0) continue;
    const evidenceDate = new Date(config.evidenceCheckedAt);
    const evidence = new URL(config.evidenceUrl);
    if (evidence.protocol !== "https:" || Number.isNaN(evidenceDate.getTime()) || evidenceDate > new Date()) continue;
    if (routeIds.has(config.id)) throw new Error(`Duplicate route ID: ${config.id}`);
    const baseUrl = process.env[config.baseUrlEnv]?.trim();
    if (!baseUrl) continue;
    const apiKey = config.apiKeyEnv ? process.env[config.apiKeyEnv] : undefined;

    const previousConfig = adapterConfig.get(config.gatewayId);
    if (previousConfig && (previousConfig.baseUrl !== baseUrl || previousConfig.apiKey !== apiKey)) {
      throw new Error(`Routes sharing gateway ID '${config.gatewayId}' must use identical base URL and key settings.`);
    }
    if (!adapters.has(config.gatewayId)) {
      adapters.set(config.gatewayId, new OpenAICompatibleAdapter(config.gatewayId, {
        baseUrl,
        ...(apiKey ? { apiKey } : {})
      }));
      adapterConfig.set(config.gatewayId, { baseUrl, ...(apiKey ? { apiKey } : {}) });
    }

    routeIds.add(config.id);
    routes.push({
      id: config.id,
      gatewayId: config.gatewayId,
      provider: config.provider,
      model: config.model,
      enabled: true,
      eligibility: "verified_free",
      costUsdPerMillionTokens: 0,
      evidenceUrl: config.evidenceUrl,
      evidenceCheckedAt: evidenceDate.toISOString(),
      capabilities: config.capabilities ?? ["text"],
      priority: config.priority ?? 0
    });
  }

  if (routes.length === 0) {
    throw new Error("No configured routes passed the explicit free-cost, evidence, and endpoint checks. Worker will not start.");
  }
  return { routes, adapters };
}

const { routes, adapters } = buildRoutes(parseRouteConfig());
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
      routes,
      adapters,
      {
        taskId: task.id,
        prompt: task.request,
        maxOutputTokens: positiveInteger("ZEDCU_MAX_OUTPUT_TOKENS", 1024),
        timeoutMs: requestTimeoutMs
      },
      { maxAttempts: routes.length }
    );

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

console.info(JSON.stringify({ event: "worker_started", workerId, routes: routes.map(({ id, gatewayId, provider, model }) => ({ id, gatewayId, provider, model })) }));
void loop();

async function shutdown(): Promise<void> {
  if (stopping) return;
  stopping = true;
  await pool.end();
  process.exit(0);
}
process.on("SIGTERM", () => void shutdown());
process.on("SIGINT", () => void shutdown());
