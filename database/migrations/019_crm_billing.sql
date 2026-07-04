-- Migration: CRM, Smart VAT & automated billing (Phase 6). Apply after 018.
-- Idempotent.
--
-- 1. clients — the tenant's CRM: the customers a carrier hauls for and bills.
--    Kept separate from `companies` (which is the tenant/platform table);
--    credit_limit + outstanding_balance power the assignment guardrail.
-- 2. invoices — auto-drafted when a POD lands (shipment delivered), carrying
--    the Smart-VAT treatment; approved by a human on the dashboard.
-- 3. pod_requests gains client_id + agreed_rate_eur so the delivered trigger
--    knows whom to bill and at what rate — and so assignment can be blocked
--    for over-limit clients (403).

CREATE TABLE IF NOT EXISTS clients (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name                TEXT NOT NULL,
    country             TEXT NOT NULL DEFAULT 'SI',      -- ISO-2
    vat_id              TEXT,                            -- e.g. DE811907980
    email               TEXT,
    credit_limit        NUMERIC(12, 2) NOT NULL DEFAULT 10000,
    outstanding_balance NUMERIC(12, 2) NOT NULL DEFAULT 0,
    default_rate_eur    NUMERIC(12, 2),                  -- agreed rate used when a POD has none
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS clients_company_idx ON clients (company_id, name);

CREATE TABLE IF NOT EXISTS invoices (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    client_id       UUID REFERENCES clients(id) ON DELETE SET NULL,
    pod_request_id  UUID REFERENCES pod_requests(id) ON DELETE SET NULL,
    number          TEXT NOT NULL,                   -- INV-2026-0001 (per company)
    description     TEXT NOT NULL,
    amount_net      NUMERIC(12, 2) NOT NULL,
    vat_treatment   TEXT NOT NULL,                   -- standard | reverse_charge | export_zero
    vat_rate        NUMERIC(5, 2) NOT NULL DEFAULT 0,
    vat_amount      NUMERIC(12, 2) NOT NULL DEFAULT 0,
    amount_total    NUMERIC(12, 2) NOT NULL,
    vat_note        TEXT,
    currency        TEXT NOT NULL DEFAULT 'EUR',
    status          TEXT NOT NULL DEFAULT 'draft',   -- draft | approved | paid | void
    pod_url         TEXT,
    issued_at       DATE NOT NULL DEFAULT CURRENT_DATE,
    due_at          DATE,
    approved_at     TIMESTAMPTZ,
    paid_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS invoices_company_idx ON invoices (company_id, status, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS invoices_number_uniq ON invoices (company_id, number);

ALTER TABLE pod_requests ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE SET NULL;
ALTER TABLE pod_requests ADD COLUMN IF NOT EXISTS agreed_rate_eur NUMERIC(12, 2);
