-- Migration: Silent LTL matching engine (Phase 7). Apply after 019. Idempotent.
--
-- 1. partial_loads — unassigned less-than-truckload loads (spare-space cargo)
--    the engine tries to slot onto active FTL routes.
-- 2. ltl_suggestions — profitable route↔partial insertions produced by the
--    FastAPI engine, pushed live to the dispatcher and accepted/dismissed here.

CREATE TABLE IF NOT EXISTS partial_loads (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id       UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    label            TEXT NOT NULL,
    origin           TEXT NOT NULL,
    destination      TEXT NOT NULL,
    origin_lat       NUMERIC(10, 6) NOT NULL,
    origin_lng       NUMERIC(10, 6) NOT NULL,
    dest_lat         NUMERIC(10, 6) NOT NULL,
    dest_lng         NUMERIC(10, 6) NOT NULL,
    weight_kg        INTEGER NOT NULL,
    offered_rate_eur NUMERIC(12, 2) NOT NULL,
    status           TEXT NOT NULL DEFAULT 'open',  -- open | matched | dismissed
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS partial_loads_company_idx ON partial_loads (company_id, status);

CREATE TABLE IF NOT EXISTS ltl_suggestions (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id       UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    partial_load_id  UUID NOT NULL REFERENCES partial_loads(id) ON DELETE CASCADE,
    route_id         TEXT NOT NULL,          -- demo FTL route id (routes aren't persisted yet)
    route_label      TEXT NOT NULL,
    partial_label    TEXT NOT NULL,
    detour_km        NUMERIC(10, 1) NOT NULL,
    detour_min       INTEGER NOT NULL,
    added_revenue_eur NUMERIC(12, 2) NOT NULL,
    margin_eur       NUMERIC(12, 2) NOT NULL,
    score            INTEGER NOT NULL,
    status           TEXT NOT NULL DEFAULT 'suggested', -- suggested | accepted | dismissed
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ltl_suggestions_company_idx ON ltl_suggestions (company_id, status, created_at DESC);
-- One live suggestion per partial load.
CREATE UNIQUE INDEX IF NOT EXISTS ltl_suggestions_partial_uniq
    ON ltl_suggestions (partial_load_id) WHERE status = 'suggested';
