import type { ProviderRoute } from "../providers/types.js";
import { evaluateFreeRoute } from "./free-route-policy.js";

export interface RouteSelection {
  selected: ProviderRoute | null;
  rejected: Array<{ routeId: string; reason: string }>;
  paused: boolean;
  reason: "eligible_route_found" | "no_verified_zero_cost_route";
}

export function selectFreeRoute(routes: ProviderRoute[], now: Date = new Date()): RouteSelection {
  const rejected: RouteSelection["rejected"] = [];
  for (const route of routes) {
    const decision = evaluateFreeRoute(route, now);
    if (decision.allowed) {
      return { selected: route, rejected, paused: false, reason: "eligible_route_found" };
    }
    rejected.push({ routeId: route.id, reason: decision.reason });
  }
  return { selected: null, rejected, paused: true, reason: "no_verified_zero_cost_route" };
}
