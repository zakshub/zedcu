import type { ProviderAdapter, ProviderFailure, ProviderRequest, ProviderResponse, ProviderRoute } from "./types.js";
import { ProviderFailure as ProviderFailureError } from "./types.js";
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
  reason: "success" | "no_verified_zero_cost_route" | "attempt_limit_reached" | "provider_failures" | "cancelled";
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

async function generateWithTimeout(
  adapter: ProviderAdapter,
  route: ProviderRoute,
  request: ProviderRequest
): Promise<ProviderResponse> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let onExternalAbort: (() => void) | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new ProviderFailureError("Provider request timed out.", "timeout", true));
    }, Math.max(1, request.timeoutMs));
  });
  const cancelled = new Promise<never>((_, reject) => {
    onExternalAbort = () => {
      controller.abort();
      reject(new ProviderFailureError("Provider request was cancelled.", "unknown", false));
    };
    if (request.signal?.aborted) onExternalAbort();
    else request.signal?.addEventListener("abort", onExternalAbort, { once: true });
  });

  try {
    return await Promise.race([
      adapter.generate(route, { ...request, signal: controller.signal }),
      timeout,
      cancelled
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
    if (onExternalAbort) request.signal?.removeEventListener("abort", onExternalAbort);
  }
}

/**
 * Attempts only routes that pass the current free-route policy.
 * The same route is never attempted twice in one call. If every eligible
 * route fails or the attempt budget is reached, the task pauses safely.
 * Adapters should honor the supplied AbortSignal for prompt cancellation.
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
    if (request.signal?.aborted) {
      return { state: "paused", response: null, attempts, reason: "cancelled" };
    }
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
      const response = await generateWithTimeout(adapter, route, request);
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
      if (request.signal?.aborted) {
        attempts.push({
          routeId: route.id, provider: route.provider, model: route.model,
          outcome: "failed", failureKind: "cancelled", note: "Task cancellation was requested."
        });
        return { state: "paused", response: null, attempts, reason: "cancelled" };
      }
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
