import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
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

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  console.log(JSON.stringify(getRuntimeStatus(), null, 2));
}
