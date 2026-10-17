import { OpenAICompatibleAdapter } from "../providers/openai-compatible-adapter.js";
import type { ProviderRoute } from "../providers/types.js";

export interface RouteConfig {
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

export interface WorkerRouteSet {
  routes: ProviderRoute[];
  adapters: Map<string, OpenAICompatibleAdapter>;
}

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]?.trim();
  if (!value) throw new Error(`Missing required environment setting: ${name}`);
  return value;
}

export function parseWorkerRouteConfig(env: NodeJS.ProcessEnv = process.env): RouteConfig[] {
  const raw = env.ZEDCU_ROUTES_JSON;
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

  return [{
    id: `${env.ZEDCU_GATEWAY_ID?.trim() || "openai-compatible"}:${required(env, "ZEDCU_MODEL")}`,
    gatewayId: env.ZEDCU_GATEWAY_ID?.trim() || "openai-compatible",
    provider: required(env, "ZEDCU_UPSTREAM_PROVIDER"),
    model: required(env, "ZEDCU_MODEL"),
    baseUrlEnv: "ZEDCU_GATEWAY_BASE_URL",
    apiKeyEnv: "ZEDCU_GATEWAY_API_KEY",
    evidenceUrl: required(env, "ZEDCU_FREE_EVIDENCE_URL"),
    evidenceCheckedAt: required(env, "ZEDCU_FREE_EVIDENCE_CHECKED_AT"),
    confirmedFree: env.ZEDCU_ROUTE_CONFIRMED_FREE === "true",
    costUsdPerMillionTokens: Number(env.ZEDCU_ROUTE_COST_USD_PER_MILLION_TOKENS)
  }];
}

/**
 * Creates adapters only for explicitly attested zero-cost routes. This validates
 * metadata and HTTPS evidence URLs; it does not independently verify page content
 * or provider billing. The caller must verify the exact model/account terms.
 */
export function buildWorkerRoutes(
  configs: RouteConfig[],
  env: NodeJS.ProcessEnv = process.env,
  now = new Date()
): WorkerRouteSet {
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
    if (config.enabled === false || !config.confirmedFree || config.costUsdPerMillionTokens !== 0) continue;
    const evidenceDate = new Date(config.evidenceCheckedAt);
    let evidence: URL;
    try {
      evidence = new URL(config.evidenceUrl);
    } catch {
      continue;
    }
    if (evidence.protocol !== "https:" || Number.isNaN(evidenceDate.getTime()) || evidenceDate > now) continue;
    if (routeIds.has(config.id)) throw new Error(`Duplicate route ID: ${config.id}`);
    const baseUrl = env[config.baseUrlEnv]?.trim();
    if (!baseUrl) continue;
    const apiKey = config.apiKeyEnv ? env[config.apiKeyEnv] : undefined;

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
