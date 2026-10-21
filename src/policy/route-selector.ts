import type { ProviderRoute } from "../providers/types.js";
import { evaluateFreeRoute } from "./free-route-policy.js";

export interface RouteSelection {
  selected: ProviderRoute | null;
  rejected: Array<{ routeId: string; reason: string }>;
  paused: boolean;
  reason: "eligible_route_found" | "no_verified_zero_cost_route";
}

export interface RouteSelectionOptions {
  requiredCapabilities?: string[];
}

export function selectFreeRoute(
  routes: ProviderRoute[],
  now: Date = new Date(),
  options: RouteSelectionOptions = {}
): RouteSelection {
  const rejected: RouteSelection["rejected"] = [];
  const eligible: Array<{ route: ProviderRoute; index: number }> = [];
  const requiredCapabilities = options.requiredCapabilities ?? [];

  routes.forEach((route, index) => {
    const decision = evaluateFreeRoute(route, now);
    if (!decision.allowed) {
      rejected.push({ routeId: route.id, reason: decision.reason });
      return;
    }

    const capabilities = new Set(route.capabilities ?? []);
    const missingCapability = requiredCapabilities.find((capability) => !capabilities.has(capability));
    if (missingCapability) {
      rejected.push({ routeId: route.id, reason: `missing_capability:${missingCapability}` });
      return;
    }

    if (route.cooldownUntil) {
      const cooldownUntil = new Date(route.cooldownUntil);
      if (Number.isNaN(cooldownUntil.getTime())) {
        rejected.push({ routeId: route.id, reason: "invalid_cooldown" });
        return;
      }
      if (cooldownUntil > now) {
        rejected.push({ routeId: route.id, reason: "route_in_cooldown" });
        return;
      }
    }

    eligible.push({ route, index });
  });

  eligible.sort((a, b) => {
    const priorityDifference = (b.route.priority ?? 0) - (a.route.priority ?? 0);
    return priorityDifference || a.index - b.index;
  });

  const selected = eligible[0]?.route ?? null;
  return selected
    ? { selected, rejected, paused: false, reason: "eligible_route_found" }
    : { selected: null, rejected, paused: true, reason: "no_verified_zero_cost_route" };
}
