-- Migration: field execution — POD (proof-of-delivery) scanner (Phase 5).
-- Apply after 017. Idempotent.
--
-- A dispatcher (or a geofence trigger) creates a pod_request with a single-use
-- token. The driver opens /pod/<token> on their phone, captures a photo, and
-- uploads it — attaching it as a `documents` row (subject='shipment',
-- document_type='pod') and flipping the request to 'delivered'. Single-use is
-- enforced by the status transition (pending → delivered), so a token can't be
-- replayed. Kept as its own table rather than tokens on `documents` because a
-- driver is not necessarily a platform user.

CREATE TABLE IF NOT EXISTS pod_requests (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    token           TEXT NOT NULL UNIQUE,
    label           TEXT NOT NULL,                 -- human summary, e.g. "Load BRK-4471 → Munich"
    shipment_id     UUID,                          -- optional link to a real shipment
    driver_phone    TEXT,
    status          TEXT NOT NULL DEFAULT 'pending', -- pending | delivered | expired
    pod_document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
    pod_url         TEXT,                          -- convenience copy of the uploaded file URL
    created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
    expires_at      TIMESTAMPTZ NOT NULL,
    delivered_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS pod_requests_company_idx ON pod_requests (company_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS pod_requests_token_idx ON pod_requests (token);
