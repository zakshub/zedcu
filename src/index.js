import { decideNextAction, selectNextEligibleRoute } from "./routing/policy.js";

export function getRuntimeStatus() {
  return {
    name: "ZEDCU",
    version: "0.1.0",
    phase: "routing-policy-baseline",
    spendLimitUsd: 0,
    networkRequestsEnabled: false,
    status: "local-policy-core-only"
  };
}

export function planRouteAttempt(routes, attemptedRouteIds = [], now = new Date()) {
  const route = selectNextEligibleRoute(routes, attemptedRouteIds, now);
  if (!route) {
    return { status: "paused", reason: "no_verified_free_route", route: null };
  }
  return { status: "route_selected", reason: null, route };
}

export { decideNextAction };

if (import.meta.url === new URL(process.argv[1] ?? "", "file:").href) {
  console.log(JSON.stringify(getRuntimeStatus(), null, 2));
}
