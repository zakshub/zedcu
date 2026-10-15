import { describe, expect, it } from "vitest";
import { GatewayRegistry, type GatewayDescriptor } from "../src/providers/gateway-registry.js";
import type { ProviderAdapter, ProviderRoute } from "../src/providers/types.js";

const descriptor = (overrides: Partial<GatewayDescriptor> = {}): GatewayDescriptor => ({
  id: "gateway-a",
  displayName: "Gateway A",
  kind: "hosted",
  protocol: "openai_compatible",
  enabled: true,
  supportsStreaming: false,
  supportsCancellation: true,
  ...overrides
});

const adapter: ProviderAdapter = {
  providerId: "test-adapter",
  async generate() {
    return { text: "ok", reportedCostUsd: 0 };
  }
};

const route: ProviderRoute = {
  id: "route-a",
  provider: "upstream-model-provider",
  gatewayId: "gateway-a",
  model: "model-a",
  enabled: true,
  eligibility: "verified_free",
  costUsdPerMillionTokens: 0,
  evidenceUrl: "https://example.test/pricing",
  evidenceCheckedAt: "2026-10-15T00:00:00.000Z"
};

describe("GatewayRegistry", () => {
  it("resolves a route through its gateway independently of its upstream provider", () => {
    const registry = new GatewayRegistry();
    registry.register(descriptor(), adapter);
    expect(registry.getAdapterForRoute(route)).toBe(adapter);
  });

  it("preserves backwards compatibility when no gateway id is provided", () => {
    const registry = new GatewayRegistry();
    registry.register(descriptor({ id: "upstream-model-provider" }), adapter);
    const { gatewayId: _gatewayId, ...legacyRoute } = route;
    expect(registry.getAdapterForRoute(legacyRoute)).toBe(adapter);
  });

  it("does not resolve disabled gateways", () => {
    const registry = new GatewayRegistry();
    registry.register(descriptor({ enabled: false }), adapter);
    expect(registry.getAdapterForRoute(route)).toBeUndefined();
  });

  it("rejects duplicate gateway IDs", () => {
    const registry = new GatewayRegistry();
    registry.register(descriptor(), adapter);
    expect(() => registry.register(descriptor(), adapter)).toThrow(/already registered/);
  });

  it("returns defensive descriptor copies", () => {
    const registry = new GatewayRegistry();
    registry.register(descriptor(), adapter);
    const listed = registry.getDescriptor("gateway-a");
    if (listed) listed.enabled = false;
    expect(registry.getDescriptor("gateway-a")?.enabled).toBe(true);
  });
});
