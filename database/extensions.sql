-- =============================================================================
-- VECTRA Platform — Schema Extension Migration
-- File: extensions.sql
-- Depends on: init.sql (must be executed first)
--
-- This migration safely extends the base schema created by init.sql.
-- All statements use CREATE TABLE IF NOT EXISTS and
-- ALTER TABLE ... ADD COLUMN IF NOT EXISTS so the script is fully
-- idempotent and can be re-run without errors.
-- =============================================================================


-- =============================================================================
-- 1. EXTEND: vehicles
--    New columns for full fleet specs and telematics integration.
-- =============================================================================

-- Physical dimensions
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS trailer_id       VARCHAR(100);
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS height_m         DECIMAL(5,2);
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS width_m          DECIMAL(5,2);
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS length_m         DECIMAL(5,2);

-- Live telematics / GPS
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS gps_lat          DECIMAL(10,8);
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS gps_lng          DECIMAL(11,8);
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS speed_kmh        INTEGER DEFAULT 0;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS trip_status      VARCHAR(50) DEFAULT 'idle';    -- 'idle', 'in_transit', 'stopped'
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS driver_status    VARCHAR(50) DEFAULT 'off_duty'; -- 'available', 'driving', 'on_break', 'off_duty'

-- Data source / sync metadata
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS data_source          VARCHAR(50)  DEFAULT 'manual'; -- 'manual', 'api_sync'
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS telematics_provider  VARCHAR(100);                  -- 'samsara', 'geotab', etc.
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS last_synced_at        TIMESTAMP WITH TIME ZONE;

-- Current utilisation
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS current_load_percent INTEGER DEFAULT 0;


-- =============================================================================
-- 2. NEW TABLE: trailers
--    Standalone trailer inventory, optionally assigned to a vehicle.
-- =============================================================================

CREATE TABLE IF NOT EXISTS trailers (
    id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id           UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    trailer_code         VARCHAR(100) NOT NULL,
    trailer_type         VARCHAR(100) NOT NULL,           -- 'curtainsider', 'refrigerated', 'flatbed', 'box', 'tanker'
    assigned_vehicle_id  UUID REFERENCES vehicles(id) ON DELETE SET NULL,
    max_weight_kg        INTEGER,
    max_volume_m3        DECIMAL(10,2),
    length_m             DECIMAL(5,2),
    height_m             DECIMAL(5,2),
    width_m              DECIMAL(5,2),
    status               VARCHAR(50) DEFAULT 'available', -- 'available', 'attached', 'in_maintenance'
    created_at           TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


-- =============================================================================
-- 3. NEW TABLE: integration_credentials
--    Stores per-company API credentials for third-party telematics providers.
--    credentials_json should be encrypted at the application layer in production.
-- =============================================================================

CREATE TABLE IF NOT EXISTS integration_credentials (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id        UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    provider_id       VARCHAR(100) NOT NULL,
    credentials_json  TEXT NOT NULL DEFAULT '{}',           -- encrypted in production
    status            VARCHAR(50) DEFAULT 'pending',        -- 'connected', 'disconnected', 'error', 'pending'
    connected_at      TIMESTAMP WITH TIME ZONE,
    last_sync_at      TIMESTAMP WITH TIME ZONE,
    sync_error        TEXT,
    created_at        TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (company_id, provider_id)
);


-- =============================================================================
-- 4. NEW TABLE: webhook_events
--    Append-only log of every inbound webhook received from external providers.
-- =============================================================================

CREATE TABLE IF NOT EXISTS webhook_events (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider            VARCHAR(100) NOT NULL,
    event_type          VARCHAR(200) NOT NULL,
    payload             JSONB NOT NULL,
    received_at         TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    processed           BOOLEAN DEFAULT FALSE,
    processing_error    TEXT,
    related_company_id  UUID REFERENCES companies(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_provider    ON webhook_events (provider);
CREATE INDEX IF NOT EXISTS idx_webhook_events_received_at ON webhook_events (received_at DESC);


-- =============================================================================
-- 5. EXTEND: ratings
--    Granular sub-score columns for carrier-side and shipper-side criteria,
--    plus a role tag so queries can filter by which party is reviewing.
-- =============================================================================

-- Carrier-evaluated criteria
ALTER TABLE ratings ADD COLUMN IF NOT EXISTS delivery_punctuality  DECIMAL(3,1) CHECK (delivery_punctuality  >= 1 AND delivery_punctuality  <= 5);
ALTER TABLE ratings ADD COLUMN IF NOT EXISTS cargo_condition       DECIMAL(3,1) CHECK (cargo_condition       >= 1 AND cargo_condition       <= 5);
ALTER TABLE ratings ADD COLUMN IF NOT EXISTS communication         DECIMAL(3,1) CHECK (communication         >= 1 AND communication         <= 5);

-- Shipper-evaluated criteria
ALTER TABLE ratings ADD COLUMN IF NOT EXISTS payment_speed         DECIMAL(3,1) CHECK (payment_speed         >= 1 AND payment_speed         <= 5);
ALTER TABLE ratings ADD COLUMN IF NOT EXISTS loading_conditions    DECIMAL(3,1) CHECK (loading_conditions    >= 1 AND loading_conditions    <= 5);
ALTER TABLE ratings ADD COLUMN IF NOT EXISTS shipment_accuracy     DECIMAL(3,1) CHECK (shipment_accuracy     >= 1 AND shipment_accuracy     <= 5);

-- Direction tag: who is rating whom
ALTER TABLE ratings ADD COLUMN IF NOT EXISTS rating_role           VARCHAR(50); -- 'shipper_rates_carrier' or 'carrier_rates_shipper'


-- =============================================================================
-- 6. NEW TABLE: company_trust_metrics
--    Materialised / cached aggregate stats per company.
--    Recalculated periodically by a background job; never written by end-users.
-- =============================================================================

CREATE TABLE IF NOT EXISTS company_trust_metrics (
    company_id               UUID PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
    total_shipments_completed  INTEGER     DEFAULT 0,
    success_rate               DECIMAL(5,2) DEFAULT 0,
    on_time_delivery_rate      DECIMAL(5,2) DEFAULT 0,
    payment_reliability_rate   DECIMAL(5,2) DEFAULT 0,
    avg_payment_days           DECIMAL(5,1),
    avg_rating_score           DECIMAL(3,2),
    total_reviews              INTEGER     DEFAULT 0,
    is_verified                BOOLEAN     DEFAULT FALSE,
    verification_badges        JSONB       DEFAULT '[]', -- e.g. ['business_registration', 'vat', 'transport_license']
    last_calculated_at         TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


-- =============================================================================
-- 7. NEW TABLE: company_verification_checks
--    Individual admin-driven verification checks per company, one row per
--    check type, enforced by a UNIQUE constraint.
-- =============================================================================

CREATE TABLE IF NOT EXISTS company_verification_checks (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id   UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    check_type   VARCHAR(100) NOT NULL,                -- 'business_registration', 'vat_number', 'transport_license'
    status       verification_status DEFAULT 'pending',
    verified_at  TIMESTAMP WITH TIME ZONE,
    verified_by  UUID REFERENCES users(id) ON DELETE SET NULL,
    notes        TEXT,
    created_at   TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (company_id, check_type)
);


-- =============================================================================
-- 8. PERFORMANCE INDEXES
--    Covers the most common filter and join patterns introduced by this
--    migration as well as high-frequency access paths on existing tables.
-- =============================================================================

-- vehicles
CREATE INDEX IF NOT EXISTS idx_vehicles_company_id   ON vehicles (company_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_data_source  ON vehicles (data_source);
CREATE INDEX IF NOT EXISTS idx_vehicles_trip_status  ON vehicles (trip_status);

-- ratings
CREATE INDEX IF NOT EXISTS idx_ratings_reviewee_id   ON ratings (reviewee_id);
CREATE INDEX IF NOT EXISTS idx_ratings_booking_id    ON ratings (booking_id);

-- integration_credentials
CREATE INDEX IF NOT EXISTS idx_integration_credentials_company ON integration_credentials (company_id);

-- bookings
CREATE INDEX IF NOT EXISTS idx_bookings_carrier_company  ON bookings (carrier_company_id);
CREATE INDEX IF NOT EXISTS idx_bookings_shipper_company  ON bookings (shipper_company_id);

-- company_trust_metrics — supports leaderboard / ranking queries
CREATE INDEX IF NOT EXISTS idx_company_trust_metrics ON company_trust_metrics (avg_rating_score DESC);
