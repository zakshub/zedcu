import type { ProviderAdapter, ProviderRequest, ProviderResponse, ProviderRoute } from "./types.js";
import { ProviderFailure } from "./types.js";

export interface OpenAICompatibleAdapterOptions {
  /** Absolute HTTP(S) base URL, usually ending in /v1. */
  baseUrl: string;
  /** Secret supplied by server-side configuration; never log or return it. */
  apiKey?: string;
  /** Test seam; defaults to the platform fetch implementation. */
  fetchImpl?: typeof fetch;
  /** Optional extra headers for a trusted gateway. */
  headers?: Record<string, string>;
}

interface ChatCompletionPayload {
  choices?: Array<{ message?: { content?: unknown } }>;
  usage?: { prompt_tokens?: unknown; completion_tokens?: unknown; total_tokens?: unknown };
  error?: { message?: unknown; type?: unknown; code?: unknown };
}

function classifyStatus(status: number, code?: string): { kind: "rate_limit" | "quota_exhausted" | "authentication" | "transient" | "unknown"; retryable: boolean } {
  if (status === 401 || status === 403) return { kind: "authentication", retryable: false };
  if (status === 429 && /quota|billing|insufficient_quota/i.test(code ?? "")) {
    return { kind: "quota_exhausted", retryable: false };
  }
  if (status === 429) return { kind: "rate_limit", retryable: true };
  if (status === 408 || status === 409 || status >= 500) return { kind: "transient", retryable: true };
  return { kind: "unknown", retryable: false };
}

function tokenCount(value: unknown): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}

function endpoint(baseUrl: string): string {
  const trimmed = baseUrl.trim();
  if (!trimmed) throw new Error("OpenAI-compatible gateway base URL is required.");
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("OpenAI-compatible gateway base URL must be an absolute URL.");
  }
  if (parsed.protocol !== "https:" && parsed.hostname !== "localhost" && parsed.hostname !== "127.0.0.1") {
    throw new Error("OpenAI-compatible gateway must use HTTPS except for localhost development.");
  }
  parsed.hash = "";
  parsed.search = "";
  const normalized = parsed.toString().replace(/\/$/, "");
  return normalized.endsWith("/chat/completions") ? normalized : `${normalized}/chat/completions`;
}

/**
 * Generic OpenAI-compatible chat-completions adapter.
 *
 * It does not determine whether a model is free. The caller must run the
 * route through the independent free-route policy first. A zero cost result
 * is returned only when the route explicitly declares a zero token price;
 * this is route metadata, not independent provider billing evidence.
 */
export class OpenAICompatibleAdapter implements ProviderAdapter {
  readonly providerId: string;
  private readonly url: string;
  private readonly fetchImpl: typeof fetch;
  private readonly headers: Record<string, string>;

  constructor(providerId: string, options: OpenAICompatibleAdapterOptions) {
    if (!providerId.trim()) throw new Error("Provider ID must not be blank.");
    this.providerId = providerId.trim();
    this.url = endpoint(options.baseUrl);
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.headers = { ...(options.headers ?? {}) };
    if (options.apiKey?.trim()) this.headers.Authorization = `Bearer ${options.apiKey.trim()}`;
  }

  async generate(route: ProviderRoute, request: ProviderRequest): Promise<ProviderResponse> {
    if (!route.model.trim()) throw new ProviderFailure("Model ID is required.", "unknown", false);
    let response: Response;
    try {
      response = await this.fetchImpl(this.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...this.headers
        },
        body: JSON.stringify({
          model: route.model,
          messages: [{ role: "user", content: request.prompt }],
          max_tokens: request.maxOutputTokens,
          stream: false
        }),
        ...(request.signal ? { signal: request.signal } : {})
      });
    } catch (error) {
      if (request.signal?.aborted) {
        throw new ProviderFailure("Gateway request was cancelled.", "unknown", false);
      }
      if (error instanceof Error && error.name === "AbortError") {
        throw new ProviderFailure("Gateway request was aborted.", "timeout", true);
      }
      throw new ProviderFailure("Gateway network request failed.", "transient", true);
    }

    let payload: ChatCompletionPayload;
    try {
      payload = await response.json() as ChatCompletionPayload;
    } catch {
      throw new ProviderFailure("Gateway returned invalid JSON.", response.ok ? "unknown" : "transient", !response.ok);
    }

    if (!response.ok) {
      const code = typeof payload.error?.code === "string" ? payload.error.code : undefined;
      const classification = classifyStatus(response.status, code);
      // Do not expose arbitrary gateway response bodies or secrets in audit logs.
      throw new ProviderFailure(`Gateway request failed with HTTP ${response.status}.`, classification.kind, classification.retryable);
    }

    const text = payload.choices?.[0]?.message?.content;
    if (typeof text !== "string") {
      throw new ProviderFailure("Gateway response did not contain a text completion.", "unknown", false);
    }

    const inputTokens = tokenCount(payload.usage?.prompt_tokens);
    const outputTokens = tokenCount(payload.usage?.completion_tokens);
    const result: ProviderResponse = { text };
    if (inputTokens !== undefined) result.inputTokens = inputTokens;
    if (outputTokens !== undefined) result.outputTokens = outputTokens;
    if (route.eligibility === "verified_free" && route.costUsdPerMillionTokens === 0) {
      result.reportedCostUsd = 0;
    }
    return result;
  }
}
