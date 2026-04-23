-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 003: Driver Terminal
--
-- Adds the tables and schema changes required for the PWA driver terminal:
--   1. shipment_assignments  — links a shipment to a vehicle + driver
--   2. driver_status_log     — immutable audit trail of driver status changes
--   3. driver_pod_documents  — proof-of-delivery photo records
--   4. Extend shipment_status enum with driver lifecycle values
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── 1. Extend the shipment_status enum ───────────────────────────────────────
-- PostgreSQL requires ALTER TYPE … ADD VALUE outside a transaction block on
-- older versions, but since 12.x it is allowed inside a transaction.
-- We use IF NOT EXISTS to make this re-runnable.

ALTER TYPE shipment_status ADD VALUE IF NOT EXISTS 'assigned';
ALTER TYPE shipment_status ADD VALUE IF NOT EXISTS 'arrived_at_pickup';
ALTER TYPE shipment_status ADD VALUE IF NOT EXISTS 'loaded_en_route';
ALTER TYPE shipment_status ADD VALUE IF NOT EXISTS 'arrived_at_delivery';
ALTER TYPE shipment_status ADD VALUE IF NOT EXISTS 'completed';

-- ── 2. shipment_assignments ───────────────────────────────────────────────────
-- Tracks which vehicle AND driver are handling a shipment.
-- One-to-one with shipment_id (UNIQUE enforces single active assignment).

CREATE TABLE IF NOT EXISTS shipment_assignments (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shipment_id     UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
    vehicle_id      UUID NOT NULL REFERENCES vehicles(id) ON DELETE RESTRICT,
    driver_id       UUID          REFERENCES drivers(id)  ON DELETE SET NULL,
    assigned_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT shipment_assignments_shipment_id_key UNIQUE (shipment_id)
);

CREATE INDEX IF NOT EXISTS idx_shipment_assignments_driver_id
    ON shipment_assignments (driver_id);

CREATE INDEX IF NOT EXISTS idx_shipment_assignments_vehicle_id
    ON shipment_assignments (vehicle_id);

-- ── 3. driver_status_log ─────────────────────────────────────────────────────
-- Immutable audit trail; one row per status transition.
-- Allows replaying timeline and computing dwell times.

CREATE TABLE IF NOT EXISTS driver_status_log (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shipment_id     UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
    driver_id       UUID          REFERENCES drivers(id)   ON DELETE SET NULL,
    from_status     TEXT,
    to_status       TEXT NOT NULL,
    recorded_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    lat             DECIMAL(10,8),
    lng             DECIMAL(11,8)
);

CREATE INDEX IF NOT EXISTS idx_driver_status_log_shipment_id
    ON driver_status_log (shipment_id);

-- ── 4. driver_pod_documents ──────────────────────────────────────────────────
-- Stores proof-of-delivery photos uploaded by the driver.
-- Multiple photos per shipment are allowed (receipt, label, signature …).

CREATE TABLE IF NOT EXISTS driver_pod_documents (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shipment_id     UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
    driver_id       UUID          REFERENCES drivers(id)   ON DELETE SET NULL,
    file_url        TEXT NOT NULL,
    original_name   TEXT,
    mime_type       TEXT,
    size_bytes      INTEGER,
    uploaded_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_driver_pod_documents_shipment_id
    ON driver_pod_documents (shipment_id);

-- ── 5. Link drivers to users (optional one-to-one) ───────────────────────────
-- Allows a driver to authenticate via the existing users table.
-- NULL = driver not yet linked to a user account (managed-only mode).

ALTER TABLE drivers
    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_drivers_user_id
    ON drivers (user_id)
    WHERE user_id IS NOT NULL;

COMMIT;
