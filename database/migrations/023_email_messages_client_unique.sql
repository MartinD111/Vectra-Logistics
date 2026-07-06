-- Migration: relax email_messages uniqueness so one Graph message can map to
-- multiple client-scoped rows (Phase 5, D-07 — a message sent to recipients at
-- two different clients' domains produces one email_messages row per client).
-- Apply after 022. Idempotent.

DO $$
DECLARE
  cname text;
BEGIN
  SELECT conname INTO cname
  FROM pg_constraint
  WHERE conrelid = 'email_messages'::regclass
    AND contype = 'u'
    AND conname != 'email_messages_company_outlook_client_uniq'
  LIMIT 1;

  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE email_messages DROP CONSTRAINT %I', cname);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS email_messages_company_outlook_client_uniq
  ON email_messages (company_id, outlook_id, client_id);
