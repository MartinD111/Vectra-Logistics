import { integrationRegistry, IntegrationCategory } from './integrationService';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WebhookEvent {
  id: string;
  provider: string;
  eventType: string;
  payload: unknown;
  receivedAt: string;
  processed: boolean;
  processingError?: string;
}

// ---------------------------------------------------------------------------
// WebhookService
// ---------------------------------------------------------------------------

export class WebhookService {
  /**
   * Entry point for all incoming webhooks.
   * Logs, routes to the appropriate domain handler, then persists the event log.
   */
  async processWebhook(
    provider: string,
    eventType: string,
    payload: unknown,
  ): Promise<void> {
    console.log(
      `[WebhookService] Received webhook from ${provider}, type: ${eventType}`,
    );

    try {
      await this.routeToHandler(provider, eventType, payload);
      await this.logWebhookEvent({
        provider,
        eventType,
        payload,
        receivedAt: new Date().toISOString(),
        processed: true,
      });
    } catch (error) {
      const err = error as Error;
      console.error(
        `[WebhookService] Error processing webhook from ${provider}:`,
        err.message,
      );
      await this.logWebhookEvent({
        provider,
        eventType,
        payload,
        receivedAt: new Date().toISOString(),
        processed: false,
        processingError: err.message,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Routing
  // ---------------------------------------------------------------------------

  /**
   * Resolves the adapter registered for `provider` and uses its category to
   * dispatch the payload to the correct domain handler.
   * Falls back to a generic log if the provider is unknown or has no handler.
   */
  private async routeToHandler(
    provider: string,
    eventType: string,
    payload: unknown,
  ): Promise<void> {
    const adapter = integrationRegistry.getAdapter(provider);

    if (!adapter) {
      console.warn(
        `[WebhookService] No adapter registered for provider "${provider}". ` +
          `Event type "${eventType}" will not be handled.`,
      );
      return;
    }

    // Delegate to the adapter's own webhook handler first (if implemented)
    if (adapter.handleWebhook) {
      await adapter.handleWebhook(payload);
    }

    // Route to the appropriate domain handler based on integration category
    switch (adapter.category) {
      case IntegrationCategory.FLEET_TELEMATICS:
        await this.handleTelematicsEvent(provider, payload);
        break;

      case IntegrationCategory.TMS:
        await this.handleTMSEvent(provider, payload);
        break;

      case IntegrationCategory.MAPPING:
        console.log(
          `[WebhookService] Mapping event from ${provider} (eventType: ${eventType}) — no handler defined.`,
        );
        break;

      case IntegrationCategory.DOCUMENTS:
        console.log(
          `[WebhookService] Documents event from ${provider} (eventType: ${eventType}) — no handler defined.`,
        );
        break;

      default:
        console.warn(
          `[WebhookService] Unhandled category "${(adapter as { category: string }).category}" ` +
            `for provider "${provider}".`,
        );
    }
  }

  // ---------------------------------------------------------------------------
  // Domain handlers
  // ---------------------------------------------------------------------------

  /**
   * Handles incoming telematics events (Samsara, Geotab, Webfleet, Wialon …).
   *
   * TODO: Parse TelematicsVehicleData from payload and persist the updated
   *       vehicle location to the database, then broadcast the change to any
   *       connected clients via the My Fleet socket channel.
   */
  private async handleTelematicsEvent(
    provider: string,
    payload: unknown,
  ): Promise<void> {
    console.log(
      `[WebhookService] Telematics event from ${provider} — will update My Fleet module`,
    );

    // Future implementation outline:
    // 1. Cast / validate payload to TelematicsVehicleData
    // 2. UPDATE trucks SET gps_lat, gps_lng, speed, trip_status, driver_status
    //    WHERE id = vehicleData.truckId
    // 3. Emit real-time position update via Socket.IO to subscribed clients
  }

  /**
   * Handles incoming TMS events (Transporeon, Alpega …).
   *
   * TODO: Parse the TMS-specific shipment payload and sync it with the
   *       platform's shipment / booking records.
   */
  private async handleTMSEvent(
    provider: string,
    payload: unknown,
  ): Promise<void> {
    console.log(
      `[WebhookService] TMS event from ${provider} — will sync shipments`,
    );

    // Future implementation outline:
    // 1. Identify the event sub-type (e.g. shipment_created, status_update)
    // 2. Upsert the corresponding booking / shipment row in the database
    // 3. Trigger any downstream notifications (e.g. email, push)
  }

  // ---------------------------------------------------------------------------
  // Persistence / audit log
  // ---------------------------------------------------------------------------

  /**
   * Logs a processed webhook event.
   *
   * Currently writes to stdout as structured JSON.
   * Future: INSERT INTO webhook_events (id, provider, event_type, payload,
   *         received_at, processed, processing_error) VALUES (…)
   */
  private async logWebhookEvent(
    event: Omit<WebhookEvent, 'id'>,
  ): Promise<void> {
    // Generate a lightweight correlation ID without an external dependency.
    // Replace with `uuid` if the package is imported elsewhere in the module.
    const id =
      `wh_${Date.now().toString(36)}_` +
      Math.random().toString(36).slice(2, 9);

    const fullEvent: WebhookEvent = { id, ...event };

    console.log(
      '[WebhookService] Event log:',
      JSON.stringify(fullEvent, null, 2),
    );
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

export const webhookService = new WebhookService();
