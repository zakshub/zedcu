import type { ProviderAdapter, ProviderFailure, ProviderRequest, ProviderResponse, ProviderRoute } from "./types.js";
import { selectFreeRoute } from "../policy/route-selector.js";

export interface RouteAttempt {
  routeId: string;
  provider: string;
  model: string;
  outcome: "success" | "failed" | "skipped";
  failureKind?: string;
  note: string;
}

export interface FallbackResult {
  state: "completed" | "paused";
  response: ProviderResponse | null;
  attempts: RouteAttempt[];
  reason: "success" | "no_verified_zero_cost_route" | "attempt_limit_reached" | "provider_failures";
}

export interface FallbackOptions {
  maxAttempts?: number;
  now?: Date;
}

function describeFailure(error: unknown): { kind: string; retryable: boolean; message: string } {
  if (error instanceof Error && "kind" in error && "retryable" in error) {
    const failure = error as ProviderFailure;
    return { kind: failure.kind, retryable: failure.retryable, message: failure.message };
  }
  if (error instanceof Error) return { kind: "unknown", retryable: true, message: error.message };
  return { kind: "unknown", retryable: true, message: "Provider failed with a non-error value." };
}

/**
 * Attempts only routes that pass the current free-route policy.
 * The same route is never attempted twice in one call. If every eligible
 * route fails or the attempt budget is reached, the task pauses safely.
 */
export async function runWithFreeFallback(
  routes: ProviderRoute[],
  adapters: Map<string, ProviderAdapter>,
  request: ProviderRequest,
  options: FallbackOptions = {}
): Promise<FallbackResult> {
  const now = options.now ?? new Date();
  const maxAttempts = Math.max(0, Math.floor(options.maxAttempts ?? routes.length));
  const attempts: RouteAttempt[] = [];
  const attemptedIds = new Set<string>();

  while (attempts.length < maxAttempts) {
    const remaining = routes.filter((route) => !attemptedIds.has(route.id));
    const selection = selectFreeRoute(remaining, now);
    if (!selection.selected) {
      return {
        state: "paused",
        response: null,
        attempts,
        reason: attempts.length === 0 ? "no_verified_zero_cost_route" : "provider_failures"
      };
    }

    const route = selection.selected;
    attemptedIds.add(route.id);
    const adapter = adapters.get(route.provider);
    if (!adapter) {
      attempts.push({
        routeId: route.id, provider: route.provider, model: route.model,
        outcome: "skipped", note: "No adapter registered for this provider."
      });
      continue;
    }

    try {
      const response = await adapter.generate(route, request);
      if (response.reportedCostUsd !== undefined && response.reportedCostUsd !== 0) {
        attempts.push({
          routeId: route.id, provider: route.provider, model: route.model,
          outcome: "failed", failureKind: "non_zero_cost_reported",
          note: "Provider response reported a non-zero cost; result rejected by zero-spend policy."
        });
        return { state: "paused", response: null, attempts, reason: "provider_failures" };
      }
      attempts.push({
        routeId: route.id, provider: route.provider, model: route.model,
        outcome: "success", note: "Route passed free-route policy and returned a response."
      });
      return { state: "completed", response, attempts, reason: "success" };
    } catch (error) {
      const failure = describeFailure(error);
      attempts.push({
        routeId: route.id, provider: route.provider, model: route.model,
        outcome: "failed", failureKind: failure.kind, note: failure.message
      });
      if (!failure.retryable) {
        return { state: "paused", response: null, attempts, reason: "provider_failures" };
      }
    }
  }

  return {
    state: "paused",
    response: null,
    attempts,
    reason: attempts.length >= maxAttempts ? "attempt_limit_reached" : "provider_failures"
  };
}
