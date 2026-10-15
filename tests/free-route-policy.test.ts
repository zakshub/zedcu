import { describe, expect, it } from "vitest";
import type { ProviderRoute } from "../src/providers/types.js";
import { evaluateFreeRoute } from "../src/policy/free-route-policy.js";
import { selectFreeRoute } from "../src/policy/route-selector.js";

const now = new Date("2026-10-15T12:00:00.000Z");
function route(overrides: Partial<ProviderRoute> = {}): ProviderRoute {
  return {
    id: "test-route", provider: "mock-provider", model: "mock-model", enabled: true,
    eligibility: "verified_free", costUsdPerMillionTokens: 0,
    evidenceUrl: "https://provider.example/pricing", evidenceCheckedAt: "2026-10-14T12:00:00.000Z",
    ...overrides
  };
}

describe("evaluateFreeRoute", () => {
  it("allows a currently evidenced zero-cost route", () => {
    expect(evaluateFreeRoute(route(), now)).toEqual({ allowed: true, reason: "verified_zero_cost" });
  });
  it("rejects paid routes", () => {
    expect(evaluateFreeRoute(route({ eligibility: "paid" }), now).allowed).toBe(false);
  });
  it("rejects unknown pricing", () => {
    expect(evaluateFreeRoute(route({ costUsdPerMillionTokens: null }), now)).toEqual({ allowed: false, reason: "cost_not_proven_zero" });
  });
  it("rejects routes without pricing evidence", () => {
    expect(evaluateFreeRoute(route({ evidenceUrl: null }), now)).toEqual({ allowed: false, reason: "missing_evidence" });
  });
  it("rejects stale evidence", () => {
    expect(evaluateFreeRoute(route({ evidenceCheckedAt: "2026-08-01T00:00:00.000Z" }), now)).toEqual({ allowed: false, reason: "stale_evidence" });
  });
});

describe("selectFreeRoute", () => {
  it("skips paid routes and selects an eligible free route", () => {
    const result = selectFreeRoute([route({ id: "paid", eligibility: "paid" }), route({ id: "free" })], now);
    expect(result.selected?.id).toBe("free");
    expect(result.paused).toBe(false);
    expect(result.rejected).toHaveLength(1);
  });
  it("pauses instead of falling back to paid routes", () => {
    const result = selectFreeRoute([route({ id: "paid", eligibility: "paid" }), route({ id: "unknown", eligibility: "unknown" })], now);
    expect(result.selected).toBeNull();
    expect(result.paused).toBe(true);
    expect(result.reason).toBe("no_verified_zero_cost_route");
  });
});
