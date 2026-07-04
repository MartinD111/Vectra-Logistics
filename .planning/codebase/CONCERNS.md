# Codebase Concerns

**Analysis Date:** 2026-07-04

## Tech Debt

### Missing integration_credentials Migration

**Issue:** The `integration_credentials` table is referenced in code but has no formal migration file. The table is queried directly by `apps/api/src/domains/outlook/outlook.repository.ts` and `apps/api/src/controllers/integrationsController.ts`, but the schema is never created via `database/migrations/`.

**Files:**
- `apps/api/src/domains/outlook/outlook.repository.ts` (lines 15–46): Direct table queries assume `integration_credentials` exists
- `apps/api/src/controllers/integrationsController.ts` (lines 40–105): Queries `integration_credentials` with fallback handling

**Impact:**
- Table creation is either missing or ad-hoc (likely created manually or in `init.sql`)
- Schema drift risk: No source-of-truth for columns, constraints, or indexes
- Onboarding/setup is fragile — new deployments may fail silently if migration is skipped
- No audit trail of when/how the schema changed

**Fix approach:**
1. Create `database/migrations/021_integration_credentials.sql` with full table definition
2. Include columns: `company_id`, `provider_id`, `credentials_json`, `status`, `connected_at`, `last_sync_at`, `sync_error`, `updated_at`
3. Add indexes: `(company_id, provider_id)` unique, `(company_id, status)`
4. Verify all code paths handle the table's absence gracefully (already done in `integrationsController`)

---

### Raw SQL Migrations Without ORM

**Issue:** All 20+ database migrations use raw SQL (PostgreSQL DDL) with no ORM abstraction layer. While this is appropriate for large migrations, it creates manual schema maintenance burden.

**Files:**
- All `database/migrations/*.sql` files (procedural DDL, no Prisma/Drizzle)

**Current risks:**
- Schema evolution requires careful manual SQL writing
- Type safety between DB schema and TypeScript models is manual (see `apps/api/src/domains/billing/billing.repository.ts` lines 42–59: manual `NUMERIC` → `number` coercion)
- No automatic migrations for new domains — each new feature requires SQL literacy
- Potential for NULL handling, constraint inconsistency, or index cardinality issues to go unnoticed

**Impact:** Medium. Migrations are well-structured (idempotent, versioned), but adding CRM features with mass Excel import and per-client email history will increase schema complexity.

**Recommended:** No immediate action needed. Monitor when implementing:
1. Email message storage (`email_messages` table for per-client history)
2. Excel import staging table (temp storage, validation, batch insert)
3. These tables will benefit from type safety — consider adopting Prisma/Drizzle for *new* migrations only (keep existing DDL as-is)

---

### No Dedicated CRM Domain

**Issue:** CRM logic is fragmented across layers. Clients, invoices, and credit limits live in the `billing` domain (repository/service), but the UI representation is only in a page-canvas block (`CrmClientsBlock.tsx`), not a dedicated API domain.

**Files:**
- `apps/workspaces/src/components/projectPage/CrmClientsBlock.tsx` (frontend block, 118 lines)
- `apps/api/src/domains/billing/billing.repository.ts` (client/invoice operations)
- `apps/api/src/domains/billing/billing.service.ts` (settlement calculations only)
- `apps/api/src/domains/billing/invoicing.service.ts` (VAT/invoice generation)

**Impact:**
- No dedicated CRM controller/routes — features like mass Excel import, email history per client, risk semaphore integration will have no natural home
- Code duplication risk: CRM operations scattered across billing, projects, and outlook domains
- Frontend imports `useBilling` hook but semantically needs `useCrm` (confusion between billing settlement vs. CRM client management)
- Email message history (upcoming feature) has no table/API surface yet

**Missing surface:**
- `apps/api/src/domains/crm/` with `crm.controller.ts`, `crm.routes.ts`, `crm.service.ts`, `crm.repository.ts`
- No CRM API endpoints: `POST /api/crm/clients/import` (Excel), `GET /api/crm/clients/:id/emails` (Outlook sync), `GET /api/crm/clients/:id/risk-semaphore` (KPI integration)

**Fix approach:**
1. Create `apps/api/src/domains/crm/` module (controller, routes, service, repository, types)
2. Move client-related operations from `billing` → `crm` (keep `billing` focused on settlements/invoicing only)
3. Coordinate with Outlook domain: CRM needs to track email message metadata for per-client history
4. Integrate KPI evaluator: credit-limit risk as a computed KPI metric

---

## Security Concerns

### Outlook OAuth Credentials Encryption ✓ (Addressed)

**Status:** MITIGATED

**Implementation:** Credentials are encrypted at rest using AES-256-GCM.

**Files:**
- `apps/api/src/core/crypto/secretBox.ts` (lines 23–52): Proper envelope encryption with random IV, auth tag, ciphertext
- `apps/api/src/domains/outlook/outlook.repository.ts` (lines 27–37): Calls `encryptSecret()` before DB storage

**Details:**
- Algorithm: AES-256-GCM (authenticated)
- IV: 96-bit random (correct for GCM)
- Auth tag: Verified on decryption (prevents tampering)
- Key source: `ENCRYPTION_KEY` env var (64-char hex = 32 bytes)
- Envelope format: JSON (iv, tag, ciphertext as hex) for self-description

**Remaining concern:** Key rotation not implemented. If `ENCRYPTION_KEY` is compromised, all old credentials remain exposed in the DB. No re-encryption job exists.

**Recommendation:** Add key rotation support:
1. Store key version with each encrypted envelope
2. Implement re-encrypt migration job when key changes
3. Document in `DEPLOYMENT.md`

---

### Plain Credentials in Legacy Code Path

**Issue:** Legacy `integrationsController.ts` (lines 87–107) has a TODO comment suggesting credentials are stored *unencrypted* for non-Outlook integrations.

**File:** `apps/api/src/controllers/integrationsController.ts` (line 87)

**Code:**
```typescript
// TODO (production): encrypt credentials_json before storage.
// For now, store them as plain JSON — this is an architecture stub.
```

**Impact:**
- Samsara, Geotab, and other legacy integrations store API keys in plaintext
- Any DB breach exposes all telematics provider credentials
- This is an "architecture stub" — the intent is clear, but incomplete

**Fix approach:**
1. Migrate legacy integrations to use `encryptSecret()` (same as Outlook does)
2. Add a migration to re-encrypt existing credentials
3. Replace TODO with actual implementation
4. Consider moving to the new Outlook service pattern for all integrations

---

## Known Issues

### Email Message Storage Table Missing

**Issue:** The upcoming "per-client email history via Microsoft Graph" feature has no backing storage. The schema includes `calendar_events` (migration 010) and `email_campaigns` (migration 011), but no `email_messages` table to store received/sent emails linked to clients.

**Files:**
- `database/migrations/011_email_campaigns.sql`: Tracks *outgoing* campaigns only
- No table for incoming email or client correspondence history

**Required for:**
- Storing email metadata (sender, recipient, subject, date, body snippet)
- Linking emails to clients (`email_messages.client_id`)
- Querying email history in CRM UI (`GET /api/crm/clients/:id/emails`)

**Impact:** Medium. Without this table, the email history feature can't be implemented. The feature is a known blocker for the full CRM.

**Fix approach:**
1. Create `database/migrations/021_email_messages.sql` (or add to 021 if consolidating):
   ```sql
   CREATE TABLE IF NOT EXISTS email_messages (
     id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
     client_id       UUID REFERENCES clients(id) ON DELETE CASCADE,
     outlook_id      TEXT,                    -- unique ID from Microsoft Graph
     sender_email    TEXT NOT NULL,
     recipient_emails TEXT[] NOT NULL DEFAULT '{}',
     subject         TEXT NOT NULL,
     body_preview    TEXT,                    -- first 500 chars
     full_body       TEXT,
     received_at     TIMESTAMPTZ NOT NULL,
     is_draft        BOOLEAN NOT NULL DEFAULT FALSE,
     synced_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     UNIQUE (company_id, outlook_id)
   );
   CREATE INDEX IF NOT EXISTS email_messages_client_idx 
     ON email_messages (company_id, client_id, received_at DESC);
   ```
2. Extend Outlook sync to fetch and store emails (not just calendar events)
3. Build client email history API endpoint

---

### KPI-CRM Credit Limit Risk Integration Undefined

**Issue:** The credit-limit risk semaphore (visual indicator of over-limit risk for clients) is not integrated with the KPI engine. Currently, the CRM block shows a simple utilization bar (`CrmClientsBlock.tsx` lines 17–36), but there's no KPI rule that computes risk over time or triggers alerts.

**Files:**
- `apps/workspaces/src/components/projectPage/CrmClientsBlock.tsx` (UI only, no KPI)
- `apps/api/src/domains/kpi/` (no CRM evaluator)

**Gap:**
- No KPI rule type like `credit_limit_utilization` or `client_risk_score`
- No evaluator to assess which clients are trending toward over-limit (e.g., balance growing 10% per week)
- No alert/event when a client crosses into critical risk zone

**Impact:** Medium. The credit-limit guardrail (assignment blocker at 100%) exists, but there's no predictive risk dashboard for operations teams.

**Fix approach:**
1. Add new KPI evaluator: `apps/api/src/domains/kpi/evaluators/creditRiskEvaluator.ts`
2. Evaluator computes: `risk_pct = (outstanding_balance / credit_limit) * 100` + trend (weekly delta)
3. Create KPI rule type `credit_risk` (scoped to a client, not a project/user)
4. Return `{ actual_value: risk_pct, target_value: 80, status: 'computed' }` in results
5. CRM UI can subscribe to KPI results to show risk trend over time

---

## Performance Bottlenecks

### Outlook Calendar Sync Without Pagination Tracking

**Issue:** `apps/api/src/domains/outlook/outlook.service.ts` (lines 174–178) fetches calendar events with `$top: '250'` in a single request, but doesn't handle Microsoft Graph pagination (nextLink). If a user has >250 events in a 44-day window, events are silently truncated.

**Code:**
```typescript
const params = new URLSearchParams({ startDateTime: start, endDateTime: end, $top: '250' });
const res = await fetch(`https://graph.microsoft.com/v1.0/me/calendarview?${params}`, ...);
```

**Files:**
- `apps/api/src/domains/outlook/outlook.service.ts` (lines 174–178)

**Impact:** Low (most users don't have 250+ events in 44 days), but data loss risk for power users or shared calendars.

**Fix approach:**
1. Check `body['@odata.nextLink']` in response
2. Loop to fetch all pages, collecting results
3. Or reduce time window to 14 days (current) to fit in single page

---

### KPI Evaluation Runs All Rules Synchronously

**Issue:** `apps/api/src/domains/kpi/kpi.service.ts` (lines 64–78) evaluates all active KPI rules sequentially in a for-loop. Each rule iterates over its evaluator outputs (potentially 100+ users × 10+ rules = 1000+ DB queries).

**Code:**
```typescript
for (const rule of rules) {
  const evaluator = getEvaluator(rule.source_type);
  const outputs = await evaluator.evaluate(rule, periodStart, periodEnd, companyId);
  for (const output of outputs) { ... }
}
```

**Files:**
- `apps/api/src/domains/kpi/kpi.service.ts` (lines 61–82)

**Impact:** Medium. If a company has 50+ active KPI rules and 100+ users, evaluation can take 30+ seconds, blocking the API endpoint.

**Fix approach:**
1. Batch evaluation: collect all rules, then map evaluators to run in parallel
2. Use BullMQ job queue for scheduled evaluation (nightly runs)
3. Cache results to avoid re-computation within 1-hour windows

---

## Fragile Areas

### CrmClientsBlock Tightly Coupled to Billing API

**Issue:** The CRM UI component imports `useBilling` hook and calls `useClients()`, creating a naming/semantic mismatch. If CRM logic moves to a separate domain, this hook becomes misleading.

**Files:**
- `apps/workspaces/src/components/projectPage/CrmClientsBlock.tsx` (line 10): `import { useClients, useCreateClient } from '@/lib/hooks/useBilling'`

**Impact:** Low, but fragile for refactoring. The hook was designed for billing (settlements), not CRM (customer relationship). If a developer adds a new billing feature, they might accidentally modify CRM logic.

**Fix approach:**
1. Create new hook file: `apps/workspaces/src/lib/hooks/useCrm.ts`
2. Move/copy `useClients` and `useCreateClient` there
3. Update import in `CrmClientsBlock.tsx`
4. Deprecate the old `useBilling` hooks (move settlement-only logic to `useBilling`)

---

### Pod Requests Schema Incomplete for CRM Integration

**Issue:** `pod_requests` table (migration 018) added `client_id` and `agreed_rate_eur` columns (migration 019), but there's no validation that these are populated when creating a POD request. Frontend code (`CrmClientsBlock`) may create clients, but the assignment flow (`apps/api/src/controllers/shipmentController.ts` or equivalent) doesn't enforce client context on POD creation.

**Files:**
- `database/migrations/019_crm_billing.sql` (lines 55–56): ALTER table adds columns, but no NOT NULL constraint
- `database/migrations/018_field_execution.sql` (lines 12–26): No mention of clients

**Gap:**
- Pod requests can have `client_id = NULL` and `agreed_rate_eur = NULL`
- Invoices depend on these values (migration 019, line 9: "the delivered trigger knows whom to bill")
- No validation at API layer to enforce these when creating assignments

**Impact:** Medium. Without strict validation, invoicing logic can't function correctly (no client to bill, no rate to use).

**Fix approach:**
1. Add constraints to migration: `ALTER TABLE pod_requests ADD CONSTRAINT pod_client_rate_check CHECK (client_id IS NOT NULL AND agreed_rate_eur IS NOT NULL)`
2. Or move to NOT NULL if all PODs must be client-linked
3. Update shipment/assignment API to require `client_id` at creation time
4. Add tests to verify invoice generation fails gracefully if client/rate missing

---

## Test Coverage Gaps

### No Tests for Outlook Encryption/Decryption

**Issue:** The `secretBox` module (`apps/api/src/core/crypto/secretBox.ts`) handles encryption of sensitive tokens, but there are no test files covering it.

**Files:**
- `apps/api/src/core/crypto/secretBox.ts` (52 lines, no `.test.ts` or `.spec.ts`)

**Risk:**
- Encryption/decryption could silently fail or lose data (JSON parse error, bad IV hex, etc.)
- Key rotation logic (when added) won't have tests to verify backward compatibility
- Integrations expecting decrypted tokens could break if envelope format changes

**Priority:** High (security-critical).

**Fix approach:**
1. Create `apps/api/src/core/crypto/secretBox.test.ts`
2. Test roundtrip: `encryptSecret(plaintext) → decryptSecret() === plaintext`
3. Test tampering detection: modify envelope → decryptSecret throws
4. Test envelope format: ensure JSON structure is consistent
5. Test missing key: ENCRYPTION_KEY undefined → AppError

---

### No Tests for KPI Evaluators

**Issue:** KPI evaluators (`apps/api/src/domains/kpi/evaluators/`) have no test files. Logic for computing utilization from calendar events or activity volume is untested.

**Files:**
- `apps/api/src/domains/kpi/evaluators/outlookCalendar.evaluator.ts` (65 lines, no tests)
- `apps/api/src/domains/kpi/evaluators/activityVolume.evaluator.ts` (likely similar)

**Risk:**
- Edge cases (workday boundary, all-day events, timezone mismatches) could cause wrong KPI values
- Adding credit-risk evaluator will inherit this gap

**Priority:** Medium.

**Fix approach:**
1. Create `apps/api/src/domains/kpi/evaluators/__tests__/`
2. Mock calendar/activity data, run evaluators, assert outputs
3. Test edge cases: empty period, no events, attendee mismatch, all-day vs. timed

---

### No Tests for Client Credit Limit Logic

**Issue:** Credit limit utilization and assignment blocking (mentioned in `CrmClientsBlock` line 32: "Over limit — new loads are blocked") is not tested at the API layer.

**Files:**
- `apps/api/src/domains/billing/billing.repository.ts` (client operations, no tests)
- Assignment enforcement unknown (likely in `shipmentController` or a service layer)

**Risk:**
- Assignment blocker could fail silently (bug in the 403 check)
- Credit limit calculation could have off-by-one or numeric precision errors
- Adjusting balance after invoice approval could leave orphaned unpaid amounts

**Priority:** High (business-critical).

**Fix approach:**
1. Add integration tests for CRM/billing flow:
   - Create client with `credit_limit = 1000`
   - Simulate shipment → invoice → balance adjustment
   - Verify assignment is blocked when `outstanding_balance >= credit_limit`
   - Verify assignment succeeds after payment reduces balance

---

## Scaling Limits

### Calendar Sync Doesn't Batch-Insert Events

**Issue:** `apps/api/src/domains/outlook/calendar.repository.ts` (lines 16–33) inserts events one-by-one in a loop. Syncing 250 calendar events = 250 round-trips to the DB.

**Code:**
```typescript
for (const e of events) {
  await db.query(`INSERT INTO calendar_events ... ON CONFLICT ...`, [...]);
}
```

**Files:**
- `apps/api/src/domains/outlook/calendar.repository.ts` (lines 16–33)

**Impact:** Low for current scale (250 events/sync, rare), but degrades at scale.

**Fix approach:**
1. Build single multi-row INSERT: `INSERT INTO calendar_events VALUES ($1, $2, ...), ($N, $N+1, ...) ON CONFLICT ...`
2. Or use `COPY` if library supports it
3. Target: <10ms for 250 events

---

### CRM Client/Invoice Queries Not Indexed for Large Companies

**Issue:** `apps/api/src/domains/billing/billing.repository.ts` (lines 63–65, 114–120) list clients and invoices with basic company_id index, but no indexes on common filter columns (status, date range).

**Queries:**
- `SELECT * FROM clients WHERE company_id = $1 ORDER BY name ASC` (OK, has index)
- `SELECT * FROM invoices WHERE company_id = $1 AND status <> 'void' ORDER BY created_at DESC LIMIT 200` (index missing on status + created_at)

**Files:**
- `database/migrations/019_crm_billing.sql` (lines 52–53): Defines indexes
  - `invoices_company_idx` on `(company_id, status, created_at DESC)` — this should exist

**Check:** Verify migration was applied and indexes are in place.

**Fix approach:** If indexes missing, create them in a new migration or verify 019 is idempotent.

---

## Missing Critical Features

### Excel Bulk Import Not Implemented

**Issue:** The CRM feature is described as supporting "mass Excel import," but there's no API endpoint, validation, or staging table for bulk operations.

**Files:**
- None exist for Excel import

**Gap:**
- No `POST /api/crm/clients/import` endpoint
- No `excel_import_staging` or similar temp table
- No CSV parser or validation rules
- No batch error reporting (line N: invalid VAT ID, etc.)

**Impact:** High. This is a planned feature mentioned in the task description. Without it, CRM operations are limited to single-client creation.

**Fix approach:**
1. Create `apps/api/src/domains/crm/importer.service.ts`
2. Define import schema: name, country, VAT ID, credit limit, default rate (CSV columns)
3. Create staging table (migration):
   ```sql
   CREATE TABLE IF NOT EXISTS crm_import_staging (
     id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     company_id      UUID NOT NULL,
     import_batch_id UUID NOT NULL,
     row_num         INT NOT NULL,
     raw_data        JSONB NOT NULL,
     parsed_data     JSONB,
     validation_errors TEXT,
     status          TEXT DEFAULT 'pending', -- pending|validated|imported|failed
     created_at      TIMESTAMPTZ DEFAULT NOW()
   );
   ```
4. Implement flow: parse → validate → stage → batch insert → commit
5. API returns import report (N created, N failed, error list)

---

### Per-Client Email History Not Fetched from Graph

**Issue:** The Outlook service syncs *calendar* events, but doesn't fetch emails from Microsoft Graph. CRM needs per-client email history (all correspondence), but the API call and DB storage are missing.

**Files:**
- `apps/api/src/domains/outlook/outlook.service.ts` (164–214): Calendar sync only
- No email history endpoint

**Gap:**
- `getFreshAccessToken()` is available (line 148), but not used for email fetching
- No Graph `/me/messages` pagination/filtering logic
- No `email_messages` table (see known issues above)

**Impact:** High. This feature is explicitly mentioned as part of the CRM extension.

**Fix approach:**
1. Add `syncMailbox()` method to `OutlookService`:
   - Fetch emails from Graph (filter by date, sender, recipient)
   - Store in `email_messages` table
   - Link to client by recipient email domain matching
2. Expose via new endpoint: `POST /api/outlook/sync-emails`
3. Schedule as a background job (every 4 hours)
4. Build CRM API: `GET /api/crm/clients/:id/emails`

---

### Credit Limit Risk Semaphore Not Integrated with KPI Engine

**Issue:** The CRM shows a credit-limit bar (visual status), but there's no KPI rule to track risk trends or alert operations when a client approaches over-limit.

**Files:**
- No credit-risk evaluator exists

**Gap:**
- CRM can show *current* utilization, but not historical trend
- No alert mechanism for risk escalation
- No dashboard integration with KPI summary page

**Impact:** Medium. Useful feature, but not blocking basic CRM.

**Fix approach:** See KPI-CRM section above.

---

## Deployment & Configuration

### ENCRYPTION_KEY Not Documented in Deployment Checklist

**Issue:** The `secretBox` module requires `ENCRYPTION_KEY` env var (64-char hex), but it's not mentioned in deployment docs or `.env.example`.

**Files:**
- `apps/api/src/core/crypto/secretBox.ts` (lines 24–28): Checks `ENCRYPTION_KEY`, throws if missing or wrong length
- No `.env.example` or `DEPLOYMENT.md` reference found

**Impact:** Medium. Missing this var on a new deployment will cause Outlook credential encryption to fail with a 500 error (message: "ENCRYPTION_KEY env var is missing or invalid").

**Fix approach:**
1. Add to `.env.example`:
   ```
   # Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
   ```
2. Update `DEPLOYMENT.md` with step-by-step setup:
   - Generate key before first deploy
   - Store in secrets manager (AWS Secrets Manager, Vercel env, etc.)
   - **Never commit to git**
3. Add startup check: log warning if key is dev default

---

## Summary of Priorities

**High (blocks next phase):**
1. Create `email_messages` table (migration 021)
2. Implement Excel bulk import endpoint & flow
3. Implement Outlook email history sync (Graph `/me/messages`)
4. Add test coverage for KPI evaluators and credit-limit logic
5. Create dedicated `crm` API domain with routes/controller

**Medium (should do before launch):**
1. Migrate legacy integrations to use `encryptSecret()`
2. Implement credit-risk KPI evaluator
3. Refactor CRM UI to use `useCrm` hook (not `useBilling`)
4. Add pagination to calendar sync
5. Optimize KPI evaluation (async/queue)

**Low (nice to have):**
1. Add `secretBox` unit tests
2. Batch-insert calendar events
3. Implement key rotation for ENCRYPTION_KEY
4. Add performance indexes for invoice queries (if not already applied)

---

*Concerns audit: 2026-07-04*
