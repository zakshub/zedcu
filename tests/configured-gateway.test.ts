import { describe, expect, it } from "vitest";
import { createConfiguredOpenAICompatibleAdapter } from "../src/providers/configured-gateway.js";
import type { GatewayDescriptor } from "../src/providers/gateway-registry.js";

const descriptor: GatewayDescriptor = {
  id: "gateway",
  displayName: "Gateway",
  kind: "hosted",
  protocol: "openai_compatible",
  enabled: true,
  apiKeyEnv: "TEST_GATEWAY_KEY",
  baseUrlEnv: "TEST_GATEWAY_URL",
  supportsStreaming: false,
  supportsCancellation: true
};

describe("createConfiguredOpenAICompatibleAdapter", () => {
  it("does not configure a gateway when its base URL is absent", () => {
    expect(createConfiguredOpenAICompatibleAdapter(descriptor, {})).toBeUndefined();
  });

  it("does not configure disabled or native-protocol gateways", () => {
    expect(createConfiguredOpenAICompatibleAdapter({ ...descriptor, enabled: false }, {
      TEST_GATEWAY_URL: "https://gateway.example/v1"
    })).toBeUndefined();
    expect(createConfiguredOpenAICompatibleAdapter({ ...descriptor, protocol: "native" }, {
      TEST_GATEWAY_URL: "https://gateway.example/v1"
    })).toBeUndefined();
  });

  it("loads server-side credentials without modifying the descriptor", () => {
    const env = {
      TEST_GATEWAY_URL: "https://gateway.example/v1",
      TEST_GATEWAY_KEY: "not-a-real-secret"
    };
    const adapter = createConfiguredOpenAICompatibleAdapter(descriptor, env);
    expect(adapter?.providerId).toBe("gateway");
    expect(descriptor).not.toHaveProperty("apiKey");
    expect(descriptor).not.toHaveProperty("secret");
  });
});
