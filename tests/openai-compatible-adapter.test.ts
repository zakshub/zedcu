import { describe, expect, it, vi } from "vitest";
import { OpenAICompatibleAdapter } from "../src/providers/openai-compatible-adapter.js";
import { ProviderFailure, type ProviderRequest, type ProviderRoute } from "../src/providers/types.js";

const request: ProviderRequest = {
  taskId: "task-1",
  prompt: "Explain the result",
  maxOutputTokens: 120,
  timeoutMs: 1_000
};

const route: ProviderRoute = {
  id: "free-route",
  provider: "upstream-provider",
  model: "example-model",
  enabled: true,
  eligibility: "verified_free",
  costUsdPerMillionTokens: 0,
  evidenceUrl: "https://provider.example/pricing",
  evidenceCheckedAt: "2026-10-16T00:00:00.000Z"
};

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

describe("OpenAICompatibleAdapter", () => {
  it("sends a compatible chat completion request and normalizes usage", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({
      choices: [{ message: { content: "Answer" } }],
      usage: { prompt_tokens: 12, completion_tokens: 7 }
    }));
    const adapter = new OpenAICompatibleAdapter("openrouter", {
      baseUrl: "https://gateway.example/v1/",
      apiKey: "secret-test-key",
      fetchImpl
    });

    const result = await adapter.generate(route, request);
    expect(result).toEqual({ text: "Answer", inputTokens: 12, outputTokens: 7, reportedCostUsd: 0 });
    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe("https://gateway.example/v1/chat/completions");
    expect(init?.method).toBe("POST");
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer secret-test-key");
    expect(JSON.parse(String(init?.body))).toEqual({
      model: "example-model",
      messages: [{ role: "user", content: "Explain the result" }],
      max_tokens: 120,
      stream: false
    });
  });

  it("does not claim zero cost for a route without verified zero-cost metadata", async () => {
    const adapter = new OpenAICompatibleAdapter("gateway", {
      baseUrl: "https://gateway.example/v1",
      fetchImpl: vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({
        choices: [{ message: { content: "Answer" } }]
      }))
    });
    const result = await adapter.generate({ ...route, eligibility: "unknown", costUsdPerMillionTokens: null }, request);
    expect(result.reportedCostUsd).toBeUndefined();
  });

  it("classifies rate limits as retryable", async () => {
    const adapter = new OpenAICompatibleAdapter("gateway", {
      baseUrl: "https://gateway.example/v1",
      fetchImpl: vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ error: { code: "rate_limit" } }, 429))
    });
    await expect(adapter.generate(route, request)).rejects.toMatchObject({
      name: "ProviderFailure",
      kind: "rate_limit",
      retryable: true
    });
  });

  it("classifies exhausted quota as non-retryable and does not expose response text", async () => {
    const adapter = new OpenAICompatibleAdapter("gateway", {
      baseUrl: "https://gateway.example/v1",
      fetchImpl: vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({
        error: { code: "insufficient_quota", message: "sensitive upstream diagnostic" }
      }, 429))
    });
    try {
      await adapter.generate(route, request);
      throw new Error("Expected provider failure");
    } catch (error) {
      expect(error).toBeInstanceOf(ProviderFailure);
      expect(error).toMatchObject({ kind: "quota_exhausted", retryable: false });
      expect((error as Error).message).not.toContain("sensitive upstream diagnostic");
    }
  });

  it("refuses insecure non-local HTTP endpoints", () => {
    expect(() => new OpenAICompatibleAdapter("gateway", { baseUrl: "http://gateway.example/v1" }))
      .toThrow(/must use HTTPS/);
  });

  it("allows localhost HTTP for local development", () => {
    expect(() => new OpenAICompatibleAdapter("local", { baseUrl: "http://localhost:1234/v1" }))
      .not.toThrow();
  });

  it("maps missing completion text to a permanent normalized failure", async () => {
    const adapter = new OpenAICompatibleAdapter("gateway", {
      baseUrl: "https://gateway.example/v1",
      fetchImpl: vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ choices: [{ message: { content: null } }] }))
    });
    await expect(adapter.generate(route, request)).rejects.toMatchObject({
      kind: "unknown",
      retryable: false
    });
  });
});
