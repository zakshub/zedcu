import { describe, expect, it } from "vitest";
import type { ProviderAdapter, ProviderRequest, ProviderResponse, ProviderRoute } from "../src/providers/types.js";
import { ProviderFailure } from "../src/providers/types.js";
import { runWithFreeFallback } from "../src/providers/fallback-runner.js";

const now = new Date("2026-10-15T12:00:00.000Z");
function route(id: string, provider = id, overrides: Partial<ProviderRoute> = {}): ProviderRoute {
  return {
    id, provider, model: "test-model", enabled: true, eligibility: "verified_free",
    costUsdPerMillionTokens: 0, evidenceUrl: "https://provider.example/pricing",
    evidenceCheckedAt: "2026-10-14T12:00:00.000Z", ...overrides
  };
}
const request: ProviderRequest = { taskId: "task-1", prompt: "test", maxOutputTokens: 100, timeoutMs: 1000 };
function adapter(providerId: string, generate: (route: ProviderRoute, request: ProviderRequest) => Promise<ProviderResponse>): ProviderAdapter {
  return { providerId, generate };
}

describe("runWithFreeFallback", () => {
  it("uses the next verified-free route after a retryable failure", async () => {
    const result = await runWithFreeFallback(
      [route("first"), route("second")],
      new Map([
        ["first", adapter("first", async () => { throw new ProviderFailure("rate limited", "rate_limit", true); })],
        ["second", adapter("second", async () => ({ text: "ok", reportedCostUsd: 0 }))]
      ]),
      request, { now }
    );
    expect(result.state).toBe("completed");
    expect(result.response?.text).toBe("ok");
    expect(result.attempts.map((item) => item.routeId)).toEqual(["first", "second"]);
  });


  it("routes through a gateway ID distinct from the upstream provider", async () => {
    let called = false;
    const result = await runWithFreeFallback(
      [route("omni-route", "upstream-provider", { gatewayId: "omniroute" })],
      new Map([["omniroute", adapter("omniroute", async () => {
        called = true;
        return { text: "ok via gateway", reportedCostUsd: 0 };
      })]]),
      request, { now }
    );
    expect(called).toBe(true);
    expect(result.state).toBe("completed");
    expect(result.attempts[0]?.gatewayId).toBe("omniroute");
    expect(result.attempts[0]?.provider).toBe("upstream-provider");
  });


  it("selects a route that satisfies requested task capabilities", async () => {
    const result = await runWithFreeFallback(
      [
        route("text-only", "text-gateway", { capabilities: ["text"], priority: 20 }),
        route("vision-route", "vision-gateway", { capabilities: ["text", "vision"], priority: 1 })
      ],
      new Map([
        ["text-gateway", adapter("text-gateway", async () => ({ text: "wrong route", reportedCostUsd: 0 }))],
        ["vision-gateway", adapter("vision-gateway", async () => ({ text: "vision-capable", reportedCostUsd: 0 }))]
      ]),
      request, { now, requiredCapabilities: ["vision"] }
    );
    expect(result.state).toBe("completed");
    expect(result.response?.text).toBe("vision-capable");
    expect(result.attempts.map((item) => item.routeId)).toEqual(["vision-route"]);
  });

  it("never calls a paid route", async () => {
    let paidCalled = false;
    const result = await runWithFreeFallback(
      [route("paid", "paid-provider", { eligibility: "paid" })],
      new Map([["paid-provider", adapter("paid-provider", async () => {
        paidCalled = true; return { text: "must not run" };
      })]]),
      request, { now }
    );
    expect(paidCalled).toBe(false);
    expect(result.state).toBe("paused");
    expect(result.reason).toBe("no_verified_zero_cost_route");
  });

  it("pauses if a provider reports non-zero cost", async () => {
    const result = await runWithFreeFallback(
      [route("first")],
      new Map([["first", adapter("first", async () => ({ text: "unexpected", reportedCostUsd: 0.01 }))]]),
      request, { now }
    );
    expect(result.state).toBe("paused");
    expect(result.response).toBeNull();
  });

  it("times out a hung adapter and pauses after exhausting routes", async () => {
    let observedAbort = false;
    const result = await runWithFreeFallback(
      [route("hung")],
      new Map([["hung", adapter("hung", async (_route: ProviderRoute, incoming: ProviderRequest): Promise<ProviderResponse> => new Promise<ProviderResponse>(() => {
        incoming.signal?.addEventListener("abort", () => { observedAbort = true; });
      }))]]),
      { ...request, timeoutMs: 5 },
      { now }
    );
    expect(result.state).toBe("paused");
    expect(result.attempts[0]?.failureKind).toBe("timeout");
    expect(observedAbort).toBe(true);
  });

  it("stops immediately when the task is already cancelled", async () => {
    const controller = new AbortController();
    controller.abort();
    let called = false;
    const result = await runWithFreeFallback(
      [route("first")],
      new Map([["first", adapter("first", async () => {
        called = true;
        return { text: "should not run" };
      })]]),
      { ...request, signal: controller.signal },
      { now }
    );
    expect(called).toBe(false);
    expect(result.state).toBe("paused");
    expect(result.reason).toBe("cancelled");
  });

  it("rejects a response when zero cost is not explicitly proven", async () => {
    const result = await runWithFreeFallback(
      [route("first")],
      new Map([["first", adapter("first", async () => ({ text: "no cost evidence" }))]]),
      request, { now }
    );
    expect(result.state).toBe("paused");
    expect(result.response).toBeNull();
    expect(result.attempts[0]?.failureKind).toBe("cost_not_proven_zero");
  });

  it("respects the attempt limit", async () => {
    const result = await runWithFreeFallback(
      [route("first"), route("second")],
      new Map([
        ["first", adapter("first", async () => { throw new ProviderFailure("busy", "transient", true); })],
        ["second", adapter("second", async () => ({ text: "should not run" }))]
      ]),
      request, { now, maxAttempts: 1 }
    );
    expect(result.state).toBe("paused");
    expect(result.reason).toBe("attempt_limit_reached");
    expect(result.attempts).toHaveLength(1);
  });
});
