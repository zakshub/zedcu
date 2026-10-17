import type { GatewayDescriptor } from "./gateway-registry.js";
import { OpenAICompatibleAdapter } from "./openai-compatible-adapter.js";

/**
 * Build a server-side adapter from environment variables named by a gateway
 * descriptor. Missing base URL means "not configured"; credentials are never
 * returned, logged, or stored in the descriptor. The caller still has to
 * register the adapter and pass concrete routes through the free-route policy.
 */
export function createConfiguredOpenAICompatibleAdapter(
  descriptor: GatewayDescriptor,
  env: NodeJS.ProcessEnv = process.env
): OpenAICompatibleAdapter | undefined {
  if (!descriptor.enabled || descriptor.protocol !== "openai_compatible") return undefined;
  const baseUrl = descriptor.baseUrlEnv ? env[descriptor.baseUrlEnv]?.trim() : undefined;
  if (!baseUrl) return undefined;
  const apiKey = descriptor.apiKeyEnv ? env[descriptor.apiKeyEnv] : undefined;
  return new OpenAICompatibleAdapter(descriptor.id, {
    baseUrl,
    ...(apiKey ? { apiKey } : {})
  });
}
