-- Migration: Durable event outbox. Apply after 025. Idempotent.
--
-- event_outbox is the canonical publication contract for durable events.
-- activity_events remains a derived analytics/history read model and is not
-- used as the source of truth for workflow or integration publication.

CREATE TABLE IF NOT EXISTS event_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  event_id UUID NOT NULL DEFAULT gen_random_uuid(),
  event_name TEXT NOT NULL,
  envelope_version INTEGER NOT NULL DEFAULT 1 CHECK (envelope_version = 1),
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  object_type TEXT NOT NULL,
  object_id UUID NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  causation_id TEXT,
  correlation_id TEXT,
  payload_version INTEGER NOT NULL DEFAULT 1 CHECK (payload_version >= 1),
  payload JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'publishing', 'published', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts INTEGER NOT NULL DEFAULT 5 CHECK (max_attempts > 0),
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_at TIMESTAMPTZ,
  locked_by TEXT,
  published_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT event_outbox_tenant_event_id_uniq UNIQUE (tenant_id, event_id)
);

CREATE INDEX IF NOT EXISTS event_outbox_pending_idx
  ON event_outbox (status, next_attempt_at, created_at)
  WHERE status IN ('pending', 'publishing');

CREATE INDEX IF NOT EXISTS event_outbox_tenant_status_idx
  ON event_outbox (tenant_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS event_outbox_object_idx
  ON event_outbox (tenant_id, object_type, object_id, created_at DESC);
