import type { ProviderAdapter, ProviderRoute } from "./types.js";

export type GatewayKind = "hosted" | "self_hosted" | "direct_provider";
export type GatewayProtocol = "openai_compatible" | "native";

export interface GatewayDescriptor {
  id: string;
  displayName: string;
  kind: GatewayKind;
  protocol: GatewayProtocol;
  enabled: boolean;
  /**
   * Environment variable NAME only, never a secret value or a browser-exposed key.
   */
  apiKeyEnv?: string;
  baseUrlEnv?: string;
  supportsStreaming: boolean;
  supportsCancellation: boolean;
  notes?: string;
}

interface GatewayRegistration {
  descriptor: GatewayDescriptor;
  adapter: ProviderAdapter;
}

/**
 * Runtime registry for interchangeable gateways. The registry does not imply
 * that a gateway is configured, reachable, free, or approved for production.
 * Free-route eligibility is checked separately by the route policy.
 */
export class GatewayRegistry {
  private readonly registrations = new Map<string, GatewayRegistration>();

  register(descriptor: GatewayDescriptor, adapter: ProviderAdapter): void {
    const id = descriptor.id.trim();
    if (!id) throw new Error("Gateway id must not be blank.");
    if (this.registrations.has(id)) throw new Error(`Gateway "${id}" is already registered.`);
    if (adapter.providerId.trim() === "") throw new Error("Adapter providerId must not be blank.");
    this.registrations.set(id, { descriptor: { ...descriptor, id }, adapter });
  }

  getDescriptor(id: string): GatewayDescriptor | undefined {
    const registration = this.registrations.get(id);
    return registration ? { ...registration.descriptor } : undefined;
  }

  getAdapterForRoute(route: ProviderRoute): ProviderAdapter | undefined {
    const gatewayId = route.gatewayId ?? route.provider;
    const registration = this.registrations.get(gatewayId);
    if (!registration || !registration.descriptor.enabled) return undefined;
    return registration.adapter;
  }

  listEnabled(): GatewayDescriptor[] {
    return [...this.registrations.values()]
      .filter(({ descriptor }) => descriptor.enabled)
      .map(({ descriptor }) => ({ ...descriptor }));
  }

  listAll(): GatewayDescriptor[] {
    return [...this.registrations.values()].map(({ descriptor }) => ({ ...descriptor }));
  }
}
