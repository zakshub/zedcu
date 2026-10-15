export type ProviderFailureKind =
  | "rate_limit" | "quota_exhausted" | "authentication" | "timeout" | "transient" | "unknown";

export interface ProviderRoute {
  id: string;
  /** Upstream provider/model owner, when known. */
  provider: string;
  /** Optional transport gateway ID; defaults to provider for older route records. */
  gatewayId?: string;
  model: string;
  enabled: boolean;
  eligibility: "verified_free" | "paid" | "unknown";
  costUsdPerMillionTokens: number | null;
  evidenceUrl: string | null;
  evidenceCheckedAt: string | null;
}

export interface ProviderRequest {
  taskId: string;
  prompt: string;
  maxOutputTokens: number;
  timeoutMs: number;
  signal?: AbortSignal;
}

export interface ProviderResponse {
  text: string;
  inputTokens?: number;
  outputTokens?: number;
  reportedCostUsd?: number;
}

export interface ProviderAdapter {
  readonly providerId: string;
  generate(route: ProviderRoute, request: ProviderRequest): Promise<ProviderResponse>;
}

export class ProviderFailure extends Error {
  constructor(message: string, readonly kind: ProviderFailureKind, readonly retryable: boolean) {
    super(message);
    this.name = "ProviderFailure";
  }
}
