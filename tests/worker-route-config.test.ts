import { describe, expect, it } from "vitest";
import { buildWorkerRoutes, parseWorkerRouteConfig, type RouteConfig } from "../src/worker/route-config.js";

const now = new Date("2026-10-17T12:00:00.000Z");
const config = (overrides: Partial<RouteConfig> = {}): RouteConfig => ({
  id: "route-one",
  gatewayId: "gateway-one",
  provider: "provider-one",
  model: "model-one",
  baseUrlEnv: "GATEWAY_ONE_URL",
  apiKeyEnv: "GATEWAY_ONE_KEY",
  evidenceUrl: "https://provider.example/pricing",
  evidenceCheckedAt: "2026-10-17T10:00:00.000Z",
  confirmedFree: true,
  costUsdPerMillionTokens: 0,
  capabilities: ["text"],
  ...overrides
});

describe("worker route configuration", () => {
  it("parses a JSON route list without embedding secrets in route definitions", () => {
    const routes = parseWorkerRouteConfig({
      ZEDCU_ROUTES_JSON: JSON.stringify([config()]),
      GATEWAY_ONE_KEY: "not-a-real-secret"
    });
    expect(routes).toHaveLength(1);
    expect(routes[0]?.apiKeyEnv).toBe("GATEWAY_ONE_KEY");
    expect(routes[0]).not.toHaveProperty("apiKey");
  });

  it("rejects malformed JSON and route lists outside the size bound", () => {
    expect(() => parseWorkerRouteConfig({ ZEDCU_ROUTES_JSON: "{" })).toThrow(/valid JSON/);
    expect(() => parseWorkerRouteConfig({ ZEDCU_ROUTES_JSON: "[]" })).toThrow(/1 to 25/);
  });

  it("keeps only explicitly attested zero-cost routes with HTTPS evidence and configured endpoints", () => {
    const result = buildWorkerRoutes([
      config(),
      config({ id: "paid", confirmedFree: false }),
      config({ id: "nonzero", costUsdPerMillionTokens: 0.1 }),
      config({ id: "insecure-evidence", evidenceUrl: "http://provider.example/pricing" }),
      config({ id: "missing-endpoint", baseUrlEnv: "MISSING_URL" })
    ], { GATEWAY_ONE_URL: "https://gateway.example/v1", GATEWAY_ONE_KEY: "not-a-real-secret" }, now);
    expect(result.routes.map((route) => route.id)).toEqual(["route-one"]);
    expect(result.adapters.size).toBe(1);
  });

  it("supports multiple routes and gateways with explicit priority and capabilities", () => {
    const result = buildWorkerRoutes([
      config({ id: "route-one", priority: 5 }),
      config({
        id: "route-two",
        gatewayId: "gateway-two",
        provider: "provider-two",
        model: "model-two",
        baseUrlEnv: "GATEWAY_TWO_URL",
        apiKeyEnv: "GATEWAY_TWO_KEY",
        priority: 10,
        capabilities: ["text", "json_mode"]
      })
    ], {
      GATEWAY_ONE_URL: "https://one.example/v1",
      GATEWAY_ONE_KEY: "one-test-key",
      GATEWAY_TWO_URL: "https://two.example/v1",
      GATEWAY_TWO_KEY: "two-test-key"
    }, now);
    expect(result.routes).toHaveLength(2);
    expect(result.adapters.size).toBe(2);
    expect(result.routes.map((route) => route.priority)).toEqual([5, 10]);
    expect(result.routes[1]?.capabilities).toEqual(["text", "json_mode"]);
  });

  it("rejects duplicate route IDs and conflicting endpoint config for one gateway ID", () => {
    expect(() => buildWorkerRoutes([config(), config()], {
      GATEWAY_ONE_URL: "https://gateway.example/v1"
    }, now)).toThrow(/Duplicate route ID/);

    expect(() => buildWorkerRoutes([
      config(),
      config({ id: "route-two", model: "model-two", baseUrlEnv: "GATEWAY_TWO_URL" })
    ], {
      GATEWAY_ONE_URL: "https://one.example/v1",
      GATEWAY_TWO_URL: "https://two.example/v1"
    }, now)).toThrow(/identical base URL and key settings/);
  });

  it("fails closed if no route passes the explicit free-only gate", () => {
    expect(() => buildWorkerRoutes([config({ confirmedFree: false })], {
      GATEWAY_ONE_URL: "https://gateway.example/v1"
    }, now)).toThrow(/No configured routes passed/);
  });
});
