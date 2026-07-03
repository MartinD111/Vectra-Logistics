-- Migration: Company AI configuration. Apply after 004. Idempotent.
--
-- One row per company selects the AI provider used by Mini Programs / Workflow
-- Automation "describe it → generate it" features. Cloud providers (openai,
-- gemini) store an ENCRYPTED api key (AES-256-GCM envelope, same scheme as
-- api_credentials) that is called ONLY from the backend proxy — the raw key is
-- never returned to the browser. Local providers (ollama-compatible) store a
-- plain, non-secret endpoint URL + model name; those are called directly from
-- the browser since a hosted backend can't reach a user's LAN. `config` holds
-- the program definition as generic JSON — no domain-specific columns.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS company_ai_config (
  company_id       UUID PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  provider         TEXT NOT NULL DEFAULT 'openai',   -- openai | gemini | local
  model            TEXT,                             -- e.g. gpt-4o, gemini-1.5-pro, gemma3
  api_key_enc      TEXT,                             -- encrypted envelope (cloud only); NULL for local
  local_endpoint   TEXT,                             -- e.g. http://localhost:11434 (local only)
  local_model      TEXT,                             -- local model name (local only)
  updated_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
