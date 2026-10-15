import test from "node:test";
import assert from "node:assert/strict";
import {
  RoutePolicyError,
  validateRoute,
  selectNextEligibleRoute,
  classifyProviderError,
  decideNextAction,
  MAX_ROUTE_ATTEMPTS
} from "../src/routing/policy.js";
import { getRuntimeStatus, planRouteAttempt } from "../src/index.js";

const now = new Date("2026-10-15T12:00:00.000Z");
const goodRoute = (id = "mock-free") => ({
  id,
  provider: "mock",
  model: "mock-model",
  enabled: true,
  pricing: "free",
  pricingEvidence: {
    verifiedFree: true,
    sourceUrl: "https://example.invalid/pricing",
    checkedAt: "2026-10-15T11:00:00.000Z"
  },
  evidenceMaxAgeDays: 7
});

test("accepts a route only with current explicit free-pricing evidence", () => {
  assert.equal(validateRoute(goodRoute(), now), true);
});

test("rejects paid and unknown routes", () => {
  for (const pricing of ["paid", "unknown", undefined]) {
    assert.throws(() => validateRoute({ ...goodRoute(), pricing }, now), RoutePolicyError);
  }
});

test("rejects disabled routes and missing evidence", () => {
  assert.throws(() => validateRoute({ ...goodRoute(), enabled: false }, now), /not enabled/);
  assert.throws(() => validateRoute({ ...goodRoute(), pricingEvidence: undefined }, now), /no complete free-pricing evidence/);
});

test("rejects stale pricing evidence", () => {
  const stale = goodRoute();
  stale.pricingEvidence.checkedAt = "2026-09-01T00:00:00.000Z";
  assert.throws(() => validateRoute(stale, now), /stale/);
});

test("selects the next verified free route and never repeats attempted routes", () => {
  const paid = { ...goodRoute("paid"), pricing: "paid" };
  const routes = [paid, goodRoute("already-tried"), goodRoute("next")];
  assert.equal(selectNextEligibleRoute(routes, ["already-tried"], now).id, "next");
  assert.equal(selectNextEligibleRoute(routes, ["already-tried", "next"], now), null);
});

test("classifies provider failures without making a network request", () => {
  assert.equal(classifyProviderError({ status: 429 }), "rate_limit");
  assert.equal(classifyProviderError({ status: 401 }), "auth");
  assert.equal(classifyProviderError({ status: 503 }), "provider_unavailable");
  assert.equal(classifyProviderError({ code: "ETIMEDOUT" }), "timeout");
  assert.equal(classifyProviderError({ code: "insufficient_quota" }), "quota_exhausted");
});

test("unknown cost always pauses; retry attempts are bounded", () => {
  assert.deepEqual(decideNextAction({ failureClass: "rate_limit" }), {
    action: "pause", reason: "cost_not_confirmed_zero"
  });
  assert.equal(decideNextAction({
    failureClass: "rate_limit", attemptsUsed: MAX_ROUTE_ATTEMPTS, costKnownZero: true
  }).action, "pause");
  assert.equal(decideNextAction({
    failureClass: "rate_limit", attemptsUsed: 0, costKnownZero: true
  }).action, "try_next_eligible_free_route");
});

test("runtime explicitly reports that provider network calls are not enabled yet", () => {
  assert.equal(getRuntimeStatus().spendLimitUsd, 0);
  assert.equal(getRuntimeStatus().networkRequestsEnabled, false);
  assert.equal(planRouteAttempt([], []).status, "paused");
});
