/**
 * ZEDCU's first routing guard.
 *
 * This module deliberately does not make network requests. Callers must supply
 * current, auditable pricing evidence from a trusted source. Unknown, stale,
 * or incomplete evidence is rejected before any provider adapter is invoked.
 */

export const MAX_ROUTE_ATTEMPTS = 2;

export class RoutePolicyError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "RoutePolicyError";
    this.code = code;
  }
}

export function validateRoute(route, now = new Date()) {
  if (!route || typeof route !== "object") {
    throw new RoutePolicyError("INVALID_ROUTE", "A route definition is required.");
  }

  if (typeof route.id !== "string" || route.id.trim() === "") {
    throw new RoutePolicyError("INVALID_ROUTE_ID", "Route id must be a non-empty string.");
  }

  if (route.enabled !== true) {
    throw new RoutePolicyError("ROUTE_DISABLED", `Route "${route.id}" is not enabled.`);
  }

  if (route.pricing !== "free") {
    throw new RoutePolicyError(
      "ROUTE_NOT_VERIFIED_FREE",
      `Route "${route.id}" is not explicitly marked free; request denied.`
    );
  }

  const evidence = route.pricingEvidence;
  if (!evidence || typeof evidence.sourceUrl !== "string" ||
      typeof evidence.checkedAt !== "string" || evidence.verifiedFree !== true) {
    throw new RoutePolicyError(
      "PRICING_EVIDENCE_MISSING",
      `Route "${route.id}" has no complete free-pricing evidence.`
    );
  }

  let checkedAt;
  try {
    checkedAt = new Date(evidence.checkedAt);
  } catch {
    checkedAt = new Date(Number.NaN);
  }
  if (Number.isNaN(checkedAt.getTime()) || checkedAt > now) {
    throw new RoutePolicyError(
      "PRICING_EVIDENCE_INVALID",
      `Route "${route.id}" has an invalid pricing evidence timestamp.`
    );
  }

  const maxAgeDays = Number.isInteger(route.evidenceMaxAgeDays)
    ? route.evidenceMaxAgeDays
    : 7;
  const ageMs = now.getTime() - checkedAt.getTime();
  if (maxAgeDays < 0 || ageMs > maxAgeDays * 24 * 60 * 60 * 1000) {
    throw new RoutePolicyError(
      "PRICING_EVIDENCE_STALE",
      `Route "${route.id}" pricing evidence is stale; request denied.`
    );
  }

  return true;
}

/**
 * Return the next route that passes the policy gate and has not already been
 * attempted for this task. Invalid routes are skipped, never force-enabled.
 */
export function selectNextEligibleRoute(routes, attemptedRouteIds = [], now = new Date()) {
  const attempted = new Set(attemptedRouteIds);
  for (const route of routes ?? []) {
    if (!route || attempted.has(route.id)) continue;
    try {
      validateRoute(route, now);
      return route;
    } catch {
      // Fail closed: skip this route and continue only to another eligible route.
    }
  }
  return null;
}

export function classifyProviderError(error) {
  const status = Number(error?.status ?? error?.statusCode);
  const code = String(error?.code ?? "").toUpperCase();
  const message = String(error?.message ?? "").toLowerCase();

  if (status === 401 || status === 403 || /invalid api key|unauthorized|permission denied/.test(message)) {
    return "auth";
  }
  if (status === 429 || /rate.?limit/.test(code) || /rate limit/.test(message)) {
    return "rate_limit";
  }
  if (/quota|insufficient_quota|billing_hard_limit/.test(code) || /quota exhausted|credit balance/.test(message)) {
    return "quota_exhausted";
  }
  if (code === "ETIMEDOUT" || code === "ECONNABORTED" || /timeout|timed out/.test(message)) {
    return "timeout";
  }
  if (status >= 500 && status <= 599) return "provider_unavailable";
  if (status >= 400 && status <= 499) return "invalid_request";
  return "unknown";
}

/**
 * Safe retry decision only; this function never retries a provider call itself.
 * Any cost uncertainty is a hard stop.
 */
export function decideNextAction({ failureClass, attemptsUsed = 0, costKnownZero = false }) {
  if (costKnownZero !== true) {
    return { action: "pause", reason: "cost_not_confirmed_zero" };
  }
  if (failureClass === "auth" || failureClass === "invalid_request" || failureClass === "unknown") {
    return { action: "pause", reason: failureClass };
  }
  if (attemptsUsed >= MAX_ROUTE_ATTEMPTS) {
    return { action: "pause", reason: "attempt_limit_reached" };
  }
  if (["rate_limit", "quota_exhausted", "timeout", "provider_unavailable"].includes(failureClass)) {
    return { action: "try_next_eligible_free_route", reason: failureClass };
  }
  return { action: "pause", reason: "unrecognized_failure_class" };
}
