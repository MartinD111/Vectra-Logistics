-- Migration: Smart Inbox & AI parsing (Phase 3). Apply after 014. Idempotent.
--
-- 1. locations — reference data for the deterministic validation layer. Broker
--    emails and railway updates name places ("Koper") or codes ("BSJJ"); the
--    validator checks extracted origins/destinations against this table.
-- 2. shipment_drafts — AI-extracted FTL / intermodal loads awaiting human
--    approval. Kept separate from `shipments` (whose lat/lng are mandatory and
--    whose status enum has no 'draft') so incomplete, unvalidated extractions
--    never pollute live shipments. On confirmation a draft can be converted to
--    a real shipment (later phase).

CREATE TABLE IF NOT EXISTS locations (
    id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code     TEXT,                              -- station / UN-LOCODE code, e.g. 'BSJJ' (nullable for plain cities)
    name     TEXT NOT NULL,
    country  TEXT NOT NULL,
    kind     TEXT NOT NULL DEFAULT 'city',      -- city | port | station
    lat      NUMERIC(10, 6),
    lng      NUMERIC(10, 6)
);

CREATE INDEX IF NOT EXISTS locations_name_idx ON locations (lower(name));
CREATE UNIQUE INDEX IF NOT EXISTS locations_code_uniq ON locations (upper(code)) WHERE code IS NOT NULL;

-- Seed a focused reference set (idempotent via NOT EXISTS). Road cities plus a
-- handful of intermodal rail terminals with codes so code-matching validation
-- (e.g. "BSJJ") works out of the box.
INSERT INTO locations (code, name, country, kind, lat, lng)
SELECT * FROM (VALUES
    (NULL, 'Ljubljana', 'SI', 'city', 46.056, 14.505),
    ('SIKOP', 'Koper', 'SI', 'port', 45.548, 13.730),
    (NULL, 'Maribor', 'SI', 'city', 46.554, 15.646),
    (NULL, 'Zagreb', 'HR', 'city', 45.815, 15.981),
    ('HRRJK', 'Rijeka', 'HR', 'port', 45.327, 14.442),
    (NULL, 'Belgrade', 'RS', 'city', 44.786, 20.448),
    (NULL, 'Vienna', 'AT', 'city', 48.208, 16.373),
    (NULL, 'Graz', 'AT', 'city', 47.070, 15.439),
    (NULL, 'Salzburg', 'AT', 'city', 47.809, 13.055),
    (NULL, 'Munich', 'DE', 'city', 48.135, 11.582),
    (NULL, 'Stuttgart', 'DE', 'city', 48.775, 9.182),
    (NULL, 'Frankfurt', 'DE', 'city', 50.110, 8.682),
    ('DEDUI', 'Duisburg', 'DE', 'port', 51.434, 6.762),
    (NULL, 'Hamburg', 'DE', 'city', 53.551, 9.993),
    (NULL, 'Munich Riem', 'DE', 'station', 48.135, 11.700),
    (NULL, 'Milan', 'IT', 'city', 45.464, 9.190),
    (NULL, 'Verona', 'IT', 'city', 45.438, 10.992),
    ('ITTRS', 'Trieste', 'IT', 'port', 45.649, 13.776),
    (NULL, 'Bologna', 'IT', 'city', 44.494, 11.342),
    (NULL, 'Budapest', 'HU', 'city', 47.497, 19.040),
    ('HUBUJ', 'Budapest BILK', 'HU', 'station', 47.420, 19.150),
    (NULL, 'Bratislava', 'SK', 'city', 48.148, 17.107),
    (NULL, 'Prague', 'CZ', 'city', 50.075, 14.437),
    (NULL, 'Warsaw', 'PL', 'city', 52.229, 21.012),
    (NULL, 'Rotterdam', 'NL', 'port', 51.924, 4.477),
    (NULL, 'Antwerp', 'BE', 'port', 51.219, 4.402),
    ('RSBSJJ', 'Belgrade Ranžirna', 'RS', 'station', 44.760, 20.400),
    ('ATWLS', 'Wels Terminal', 'AT', 'station', 48.161, 14.024),
    ('SILJT', 'Ljubljana Zalog', 'SI', 'station', 46.060, 14.560)
) AS seed(code, name, country, kind, lat, lng)
WHERE NOT EXISTS (SELECT 1 FROM locations);

CREATE TABLE IF NOT EXISTS shipment_drafts (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    project_id    UUID REFERENCES projects(id) ON DELETE SET NULL,
    status        TEXT NOT NULL DEFAULT 'needs_review',  -- needs_review | validated | confirmed | rejected
    -- Extracted, human-editable fields (drive the kanban card + review form)
    origin        TEXT,
    destination   TEXT,
    cargo_type    TEXT,
    weight_kg     INTEGER,
    pickup_date   DATE,
    delivery_date DATE,
    wagon_number  TEXT,
    reference     TEXT,
    confidence    NUMERIC(4, 3),
    -- Provenance & audit
    source        TEXT NOT NULL DEFAULT 'inbox',   -- inbox | paste | manual
    source_email  JSONB NOT NULL DEFAULT '{}',     -- {from, subject, body}
    extracted     JSONB NOT NULL DEFAULT '{}',     -- raw LLM output
    validation    JSONB NOT NULL DEFAULT '{}',     -- {ok, errors[], warnings[]}
    created_by    UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS shipment_drafts_company_idx
    ON shipment_drafts (company_id, status, created_at DESC);
