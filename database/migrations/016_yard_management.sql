-- Migration: Intermodal tracking & spatial yard management (Phase 4).
-- Apply after 015. Idempotent.
--
-- Deliberately NO PostGIS: the running Postgres image (postgres:15-alpine) has
-- no PostGIS extension, and the yard is a 2D FLOOR PLAN, not geography. Zones,
-- slots and assets are positioned in an abstract yard coordinate space
-- (units ≈ metres) rendered by Leaflet with CRS.Simple. Rectangular zones store
-- x/y/width/height; a `polygon` JSONB column is reserved for non-rectangular
-- shapes later. This keeps everything working on the existing DB with no
-- destructive image swap.

-- Physical zones: Pallet Racks, Car Lots, TEU Containers, Truck Parking.
CREATE TABLE IF NOT EXISTS yard_zones (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    project_id  UUID REFERENCES projects(id) ON DELETE SET NULL,
    name        TEXT NOT NULL,
    kind        TEXT NOT NULL DEFAULT 'pallet_rack', -- pallet_rack | car_lot | teu_container | truck_parking
    color       TEXT,
    x           NUMERIC(10, 2) NOT NULL DEFAULT 0,   -- top-left corner, yard units
    y           NUMERIC(10, 2) NOT NULL DEFAULT 0,
    width       NUMERIC(10, 2) NOT NULL DEFAULT 100,
    height      NUMERIC(10, 2) NOT NULL DEFAULT 100,
    polygon     JSONB,                               -- reserved for non-rectangular zones
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS yard_zones_company_idx ON yard_zones (company_id, project_id);

-- Individual parking/storage slots within a zone.
CREATE TABLE IF NOT EXISTS yard_slots (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    zone_id     UUID NOT NULL REFERENCES yard_zones(id) ON DELETE CASCADE,
    label       TEXT NOT NULL,
    x           NUMERIC(10, 2) NOT NULL,             -- slot centre, yard units
    y           NUMERIC(10, 2) NOT NULL,
    status      TEXT NOT NULL DEFAULT 'free',        -- free | occupied | reserved
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS yard_slots_zone_idx ON yard_slots (zone_id, status);

-- Physical assets on the yard (trucks, containers, trailers, wagons). Created
-- manually or auto-checked-in by the ANPR/OCR gate webhooks.
CREATE TABLE IF NOT EXISTS yard_assets (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    project_id    UUID REFERENCES projects(id) ON DELETE SET NULL,
    kind          TEXT NOT NULL DEFAULT 'truck',     -- truck | container | trailer | wagon
    label         TEXT NOT NULL,
    identifier    TEXT,                              -- plate / container number
    slot_id       UUID REFERENCES yard_slots(id) ON DELETE SET NULL,
    x             NUMERIC(10, 2) NOT NULL DEFAULT 0, -- current position, yard units
    y             NUMERIC(10, 2) NOT NULL DEFAULT 0,
    status        TEXT NOT NULL DEFAULT 'in_yard',   -- in_yard | gate_in | departed
    source        TEXT NOT NULL DEFAULT 'manual',    -- manual | gate_anpr | gate_ocr
    metadata      JSONB NOT NULL DEFAULT '{}',
    checked_in_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS yard_assets_company_idx ON yard_assets (company_id, status);

-- Rail wagons for the railway terminal board (status flow, not spatial).
CREATE TABLE IF NOT EXISTS rail_wagons (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    project_id    UUID REFERENCES projects(id) ON DELETE SET NULL,
    wagon_number  TEXT NOT NULL,
    status        TEXT NOT NULL DEFAULT 'in_port',   -- in_port | loading_sequence | in_transit | discharging
    seq           INTEGER NOT NULL DEFAULT 0,        -- position within the loading sequence
    cargo         TEXT,
    reference     TEXT,
    metadata      JSONB NOT NULL DEFAULT '{}',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS rail_wagons_company_idx ON rail_wagons (company_id, status, seq);
