-- Migration: dispatcher widgets (Phase 2). Apply after 013. Idempotent.
--
-- 1. fleet_exceptions — the Exception Radar feed: border delays, port/terminal
--    congestion, wagon damage reports, engine fault codes. Rows are created by
--    webhooks/integrations (or the demo simulator) and pushed to dispatchers
--    over the company socket room as 'exception:new' / 'exception:resolved'.
-- 2. chat_threads.project_id — omnichannel chat threads attached to a project
--    (existing threads are keyed by shipment only).
-- 3. chat_messages.channel — message origin: internal | whatsapp | email.

CREATE TABLE IF NOT EXISTS fleet_exceptions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    kind        TEXT NOT NULL,  -- border_delay | port_congestion | wagon_damage | engine_fault
    severity    TEXT NOT NULL DEFAULT 'warning',  -- info | warning | critical
    title       TEXT NOT NULL,
    detail      JSONB NOT NULL DEFAULT '{}',
    status      TEXT NOT NULL DEFAULT 'active',   -- active | resolved
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS fleet_exceptions_company_idx
    ON fleet_exceptions (company_id, status, created_at DESC);

ALTER TABLE chat_threads ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE CASCADE;
CREATE UNIQUE INDEX IF NOT EXISTS chat_threads_project_uniq
    ON chat_threads (project_id) WHERE project_id IS NOT NULL;

ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS channel TEXT NOT NULL DEFAULT 'internal';
