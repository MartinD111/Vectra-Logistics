-- Migration: realtime (chat, notifications) + unified documents
-- Apply after init.sql. Idempotent.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Documents ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject         TEXT NOT NULL CHECK (subject IN ('company','driver','vehicle','shipment','booking')),
  subject_id      UUID,
  document_type   TEXT NOT NULL,
  file_url        TEXT NOT NULL,
  file_name       TEXT,
  mime_type       TEXT,
  size_bytes      INTEGER,
  issued_at       DATE,
  expires_at      DATE,
  uploaded_by     UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  company_id      UUID NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS documents_subject_idx ON documents (subject, subject_id);
CREATE INDEX IF NOT EXISTS documents_company_idx ON documents (company_id);
CREATE INDEX IF NOT EXISTS documents_expires_idx ON documents (expires_at) WHERE expires_at IS NOT NULL;

-- ── Notifications ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  title       TEXT NOT NULL,
  body        TEXT,
  link        TEXT,
  is_read     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notifications_user_idx
  ON notifications (user_id, is_read, created_at DESC);

-- ── Chat ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_threads (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id  UUID UNIQUE REFERENCES shipments(id) ON DELETE CASCADE,
  booking_id   UUID,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id   UUID NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
  sender_id   UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  body        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS chat_messages_thread_idx
  ON chat_messages (thread_id, created_at);

CREATE TABLE IF NOT EXISTS chat_thread_participants (
  thread_id UUID NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (thread_id, user_id)
);
