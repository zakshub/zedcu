import type { ProviderRoute } from "../providers/types.js";

export type RouteDecision =
  | { allowed: true; reason: "verified_zero_cost" }
  | { allowed: false; reason: "route_disabled" | "not_verified_free" | "cost_not_proven_zero" | "missing_evidence" | "stale_evidence" };

const MAX_EVIDENCE_AGE_DAYS = 30;

export function evaluateFreeRoute(route: ProviderRoute, now: Date = new Date()): RouteDecision {
  if (!route.enabled) return { allowed: false, reason: "route_disabled" };
  if (route.eligibility !== "verified_free") return { allowed: false, reason: "not_verified_free" };
  if (route.costUsdPerMillionTokens !== 0) return { allowed: false, reason: "cost_not_proven_zero" };
  if (!route.evidenceUrl || !route.evidenceCheckedAt) return { allowed: false, reason: "missing_evidence" };

  const checkedAt = new Date(route.evidenceCheckedAt);
  if (Number.isNaN(checkedAt.getTime()) || checkedAt > now) return { allowed: false, reason: "stale_evidence" };
  if (now.getTime() - checkedAt.getTime() > MAX_EVIDENCE_AGE_DAYS * 24 * 60 * 60 * 1000) {
    return { allowed: false, reason: "stale_evidence" };
  }
  return { allowed: true, reason: "verified_zero_cost" };
}
