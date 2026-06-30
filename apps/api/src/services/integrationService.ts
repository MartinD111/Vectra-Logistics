/**
 * VECTRA Logistics Platform
 * Integration Service — Modular Adapter Architecture
 *
 * Provides a unified registry for all third-party integration adapters.
 * Each adapter encapsulates the auth + data-fetching logic for one provider.
 */

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export enum IntegrationCategory {
  FLEET_TELEMATICS = 'fleet_telematics',
  TMS = 'tms',
  MAPPING = 'mapping',
  DOCUMENTS = 'documents',
}

export enum AuthType {
  API_KEY = 'api_key',
  OAUTH2 = 'oauth2',
  NONE = 'none',
}

export enum IntegrationStatus {
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  ERROR = 'error',
  PENDING = 'pending',
}

// ---------------------------------------------------------------------------
// Core interfaces
// ---------------------------------------------------------------------------

export interface IIntegrationAdapter {
  providerId: string;
  providerName: string;
  category: IntegrationCategory;
  authType: AuthType;

  /** Authenticate with the provider using the supplied credentials. */
  authenticate(credentials: Record<string, string>): Promise<boolean>;

  /** Verify that a previously-established connection is still live. */
  testConnection(): Promise<boolean>;

  /** Optional: pull data from the provider. */
  fetchData?(params: Record<string, unknown>): Promise<unknown>;

  /** Optional: handle an inbound webhook payload from the provider. */
  handleWebhook?(payload: unknown): Promise<void>;
}

export interface TelematicsVehicleData {
  truckId: string;
  gpsLat: number;
  gpsLng: number;
  speed: number;
  tripStatus: 'idle' | 'in_transit' | 'stopped';
  driverStatus: 'available' | 'driving' | 'on_break' | 'off_duty';
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Fleet Telematics Adapters
// ---------------------------------------------------------------------------

export class SamsaraAdapter implements IIntegrationAdapter {
  readonly providerId = 'samsara';
  readonly providerName = 'Samsara';
  readonly category = IntegrationCategory.FLEET_TELEMATICS;
  readonly authType = AuthType.API_KEY;

  async authenticate(_credentials: Record<string, string>): Promise<boolean> {
    console.log(`[SamsaraAdapter] authenticate: Not yet implemented for ${this.providerName}`);
    return false;
  }

  async testConnection(): Promise<boolean> {
    console.log(`[SamsaraAdapter] testConnection: Test connection not yet implemented for ${this.providerName}`);
    return false;
  }

  async fetchData(_params: Record<string, unknown>): Promise<unknown> {
    console.log(`[SamsaraAdapter] fetchData: Not yet implemented for ${this.providerName}`);
    return null;
  }

  async handleWebhook(payload: unknown): Promise<void> {
    console.log(`[SamsaraAdapter] handleWebhook: Received payload from ${this.providerName}`, payload);
  }
}

export class GeotabAdapter implements IIntegrationAdapter {
  readonly providerId = 'geotab';
  readonly providerName = 'Geotab';
  readonly category = IntegrationCategory.FLEET_TELEMATICS;
  readonly authType = AuthType.OAUTH2;

  async authenticate(_credentials: Record<string, string>): Promise<boolean> {
    console.log(`[GeotabAdapter] authenticate: Not yet implemented for ${this.providerName}`);
    return false;
  }

  async testConnection(): Promise<boolean> {
    console.log(`[GeotabAdapter] testConnection: Test connection not yet implemented for ${this.providerName}`);
    return false;
  }

  async fetchData(_params: Record<string, unknown>): Promise<unknown> {
    console.log(`[GeotabAdapter] fetchData: Not yet implemented for ${this.providerName}`);
    return null;
  }

  async handleWebhook(payload: unknown): Promise<void> {
    console.log(`[GeotabAdapter] handleWebhook: Received payload from ${this.providerName}`, payload);
  }
}

export class WebfleetAdapter implements IIntegrationAdapter {
  readonly providerId = 'webfleet';
  readonly providerName = 'Webfleet';
  readonly category = IntegrationCategory.FLEET_TELEMATICS;
  readonly authType = AuthType.API_KEY;

  async authenticate(_credentials: Record<string, string>): Promise<boolean> {
    console.log(`[WebfleetAdapter] authenticate: Not yet implemented for ${this.providerName}`);
    return false;
  }

  async testConnection(): Promise<boolean> {
    console.log(`[WebfleetAdapter] testConnection: Test connection not yet implemented for ${this.providerName}`);
    return false;
  }

  async fetchData(_params: Record<string, unknown>): Promise<unknown> {
    console.log(`[WebfleetAdapter] fetchData: Not yet implemented for ${this.providerName}`);
    return null;
  }

  async handleWebhook(payload: unknown): Promise<void> {
    console.log(`[WebfleetAdapter] handleWebhook: Received payload from ${this.providerName}`, payload);
  }
}

export class WialonAdapter implements IIntegrationAdapter {
  readonly providerId = 'wialon';
  readonly providerName = 'Wialon';
  readonly category = IntegrationCategory.FLEET_TELEMATICS;
  readonly authType = AuthType.API_KEY;

  async authenticate(_credentials: Record<string, string>): Promise<boolean> {
    console.log(`[WialonAdapter] authenticate: Not yet implemented for ${this.providerName}`);
    return false;
  }

  async testConnection(): Promise<boolean> {
    console.log(`[WialonAdapter] testConnection: Test connection not yet implemented for ${this.providerName}`);
    return false;
  }

  async fetchData(_params: Record<string, unknown>): Promise<unknown> {
    console.log(`[WialonAdapter] fetchData: Not yet implemented for ${this.providerName}`);
    return null;
  }

  async handleWebhook(payload: unknown): Promise<void> {
    console.log(`[WialonAdapter] handleWebhook: Received payload from ${this.providerName}`, payload);
  }
}

// ---------------------------------------------------------------------------
// TMS Adapters
// ---------------------------------------------------------------------------

export class TransporeonAdapter implements IIntegrationAdapter {
  readonly providerId = 'transporeon';
  readonly providerName = 'Transporeon';
  readonly category = IntegrationCategory.TMS;
  readonly authType = AuthType.OAUTH2;

  async authenticate(_credentials: Record<string, string>): Promise<boolean> {
    console.log(`[TransporeonAdapter] authenticate: Not yet implemented for ${this.providerName}`);
    return false;
  }

  async testConnection(): Promise<boolean> {
    console.log(`[TransporeonAdapter] testConnection: Test connection not yet implemented for ${this.providerName}`);
    return false;
  }

  async fetchData(_params: Record<string, unknown>): Promise<unknown> {
    console.log(`[TransporeonAdapter] fetchData: Not yet implemented for ${this.providerName}`);
    return null;
  }

  async handleWebhook(payload: unknown): Promise<void> {
    console.log(`[TransporeonAdapter] handleWebhook: Received payload from ${this.providerName}`, payload);
  }
}

export class AlpegaAdapter implements IIntegrationAdapter {
  readonly providerId = 'alpega';
  readonly providerName = 'Alpega TMS';
  readonly category = IntegrationCategory.TMS;
  readonly authType = AuthType.API_KEY;

  async authenticate(_credentials: Record<string, string>): Promise<boolean> {
    console.log(`[AlpegaAdapter] authenticate: Not yet implemented for ${this.providerName}`);
    return false;
  }

  async testConnection(): Promise<boolean> {
    console.log(`[AlpegaAdapter] testConnection: Test connection not yet implemented for ${this.providerName}`);
    return false;
  }

  async fetchData(_params: Record<string, unknown>): Promise<unknown> {
    console.log(`[AlpegaAdapter] fetchData: Not yet implemented for ${this.providerName}`);
    return null;
  }

  async handleWebhook(payload: unknown): Promise<void> {
    console.log(`[AlpegaAdapter] handleWebhook: Received payload from ${this.providerName}`, payload);
  }
}

// ---------------------------------------------------------------------------
// Mapping Adapters
// ---------------------------------------------------------------------------

export class GoogleMapsAdapter implements IIntegrationAdapter {
  readonly providerId = 'google_maps';
  readonly providerName = 'Google Maps Platform';
  readonly category = IntegrationCategory.MAPPING;
  readonly authType = AuthType.API_KEY;

  async authenticate(_credentials: Record<string, string>): Promise<boolean> {
    console.log(`[GoogleMapsAdapter] authenticate: Not yet implemented for ${this.providerName}`);
    return false;
  }

  async testConnection(): Promise<boolean> {
    console.log(`[GoogleMapsAdapter] testConnection: Test connection not yet implemented for ${this.providerName}`);
    return false;
  }

  async fetchData(_params: Record<string, unknown>): Promise<unknown> {
    console.log(`[GoogleMapsAdapter] fetchData: Not yet implemented for ${this.providerName}`);
    return null;
  }
}

export class HereMapsAdapter implements IIntegrationAdapter {
  readonly providerId = 'here_maps';
  readonly providerName = 'HERE Maps API';
  readonly category = IntegrationCategory.MAPPING;
  readonly authType = AuthType.API_KEY;

  async authenticate(_credentials: Record<string, string>): Promise<boolean> {
    console.log(`[HereMapsAdapter] authenticate: Not yet implemented for ${this.providerName}`);
    return false;
  }

  async testConnection(): Promise<boolean> {
    console.log(`[HereMapsAdapter] testConnection: Test connection not yet implemented for ${this.providerName}`);
    return false;
  }

  async fetchData(_params: Record<string, unknown>): Promise<unknown> {
    console.log(`[HereMapsAdapter] fetchData: Not yet implemented for ${this.providerName}`);
    return null;
  }
}

export class OSRMAdapter implements IIntegrationAdapter {
  readonly providerId = 'osrm';
  readonly providerName = 'OpenStreetMap / OSRM';
  readonly category = IntegrationCategory.MAPPING;
  readonly authType = AuthType.NONE;

  async authenticate(_credentials: Record<string, string>): Promise<boolean> {
    console.log(`[OSRMAdapter] authenticate: Not yet implemented for ${this.providerName}`);
    return false;
  }

  async testConnection(): Promise<boolean> {
    console.log(`[OSRMAdapter] testConnection: Test connection not yet implemented for ${this.providerName}`);
    return false;
  }

  async fetchData(_params: Record<string, unknown>): Promise<unknown> {
    console.log(`[OSRMAdapter] fetchData: Not yet implemented for ${this.providerName}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Integration Registry
// ---------------------------------------------------------------------------

/**
 * IntegrationRegistry is the central catalogue of all available adapters.
 * Adapters are keyed by their providerId for O(1) lookup.
 */
export class IntegrationRegistry {
  private readonly adapters: Map<string, IIntegrationAdapter> = new Map();

  /**
   * Register an adapter in the registry.
   * Throws if an adapter with the same providerId is already registered.
   */
  register(adapter: IIntegrationAdapter): void {
    if (this.adapters.has(adapter.providerId)) {
      throw new Error(
        `[IntegrationRegistry] Adapter with providerId "${adapter.providerId}" is already registered.`
      );
    }
    this.adapters.set(adapter.providerId, adapter);
    console.log(
      `[IntegrationRegistry] Registered adapter: ${adapter.providerName} (${adapter.providerId}) — category: ${adapter.category}`
    );
  }

  /**
   * Retrieve a single adapter by its providerId.
   * Returns undefined if no adapter is found.
   */
  getAdapter(providerId: string): IIntegrationAdapter | undefined {
    return this.adapters.get(providerId);
  }

  /**
   * Retrieve all adapters that belong to a given category.
   */
  getAdaptersByCategory(category: IntegrationCategory): IIntegrationAdapter[] {
    return Array.from(this.adapters.values()).filter(
      (adapter) => adapter.category === category
    );
  }

  /**
   * Return a summary list of every registered adapter (useful for API responses).
   */
  listAll(): Array<{
    providerId: string;
    providerName: string;
    category: IntegrationCategory;
    authType: AuthType;
  }> {
    return Array.from(this.adapters.values()).map(({ providerId, providerName, category, authType }) => ({
      providerId,
      providerName,
      category,
      authType,
    }));
  }
}

// ---------------------------------------------------------------------------
// Singleton — pre-populated with all known adapters
// ---------------------------------------------------------------------------

export const integrationRegistry = new IntegrationRegistry();

// Fleet Telematics
integrationRegistry.register(new SamsaraAdapter());
integrationRegistry.register(new GeotabAdapter());
integrationRegistry.register(new WebfleetAdapter());
integrationRegistry.register(new WialonAdapter());

// TMS
integrationRegistry.register(new TransporeonAdapter());
integrationRegistry.register(new AlpegaAdapter());

// Mapping
integrationRegistry.register(new GoogleMapsAdapter());
integrationRegistry.register(new HereMapsAdapter());
integrationRegistry.register(new OSRMAdapter());
