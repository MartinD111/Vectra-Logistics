# Phase 5: Email History Sync - Pattern Map

**Mapped:** 2026-07-06
**Files analyzed:** 8 (extend/reference) + 2 new
**Analogs found:** 10 / 10

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|---------------|
| `apps/api/src/domains/outlook/outlook.service.ts` (`syncEmails()`, new method) | service | event-driven / batch (Graph pull + upsert) | `syncCalendar()` in same file (lines 156-214) | exact (sibling method, same file) |
| `apps/api/src/domains/outlook/outlook.repository.ts` (extend: watermark read/write) | model/repository | CRUD | `find()` / `upsert()` in same file (lines 14-38) | exact (extend existing methods) |
| `apps/api/src/domains/outlook/outlook.types.ts` (extend: watermark field) | model (types) | n/a | `OutlookCredentials` interface (lines 14-21) | exact |
| New: `apps/api/src/domains/outlook/email.repository.ts` | repository | CRUD (upsert) | `calendar.repository.ts` `upsertEvents()` (lines 16-33) | exact (same domain, same upsert-many shape) |
| New: worker function `scheduleEmailSync()` + BullMQ processor | service (scheduled job) | batch / event-driven | `scheduleTelematicsSync()` + `startTelematicsWorker()` in `apps/api/src/workers/telematics.worker.ts` (lines 232-299) | exact |
| `database/migrations/NNN_email_sync_watermark.sql` (new) | migration | n/a | `database/migrations/021_crm_extensions.sql` | exact (same idempotent style, same table family) |
| `apps/api/src/domains/outlook/outlook.routes.ts` | route | request-response | itself (no new route expected) | reference only |
| `apps/api/src/core/queue/index.ts` | config/registry | n/a | itself — `getQueue()` singleton, reuse directly | exact |
| `apps/api/src/core/events/activityLog.ts` | utility | event-driven (audit log) | itself — `recordEvent()`, reuse directly | exact |
| Client-domain matching logic (new, likely a small pure function/module, e.g. `email.matcher.ts` or inline in `email.repository.ts`) | utility (transform) | transform | `crm.repository.ts` `listClients()` (lines 22-24) for the client/email source data | role-match (data source, not a matching-logic analog — no existing domain-matching code in repo) |

## Pattern Assignments

### `apps/api/src/domains/outlook/outlook.service.ts` — new `syncEmails(companyId, actorId)` method

**Analog:** `syncCalendar()`, same file, lines 156-214 (sibling method — copy the whole shape, not just excerpts)

**Full method to model against** (lines 164-214):
```typescript
async syncCalendar(companyId: string, actorId: string | null): Promise<{ synced: number; skipped?: string }> {
    const conn = await outlookRepository.find(companyId);
    if (!conn || conn.status !== 'connected') return { synced: 0, skipped: 'not connected' };
    if (conn.creds.demo) return { synced: 0, skipped: 'demo mode has no real calendar to sync' };

    const creds = await this.ensureFreshToken(companyId, conn.creds);
    if (!creds.access_token) return { synced: 0, skipped: 'no access token' };

    const start = new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString();
    const end = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
    const params = new URLSearchParams({ startDateTime: start, endDateTime: end, $top: '250' });
    const res = await fetch(`https://graph.microsoft.com/v1.0/me/calendarview?${params}`, {
      headers: { Authorization: `Bearer ${creds.access_token}`, Prefer: 'outlook.timezone="UTC"' },
    });
    if (!res.ok) return { synced: 0, skipped: `Graph calendarview failed (${res.status})` };
    const body = (await res.json()) as { value: [...] };

    // ... map Graph response to upsert-shaped objects ...

    await calendarRepository.upsertEvents(companyId, events);
    await recordEvent({
      tenantId: companyId, actorId, verb: 'integration.calendar_synced',
      objectType: 'integration', payload: { provider: 'outlook', count: events.length },
    });
    return { synced: events.length };
  }
```

**What to change for `syncEmails()`:**
- Same guard sequence: `conn.status !== 'connected'` → skip; `conn.creds.demo` → skip; `ensureFreshToken()` → skip if no token. Copy verbatim (D-10).
- Watermark instead of fixed window (D-05): read `conn.last_synced_at` (or wherever the new column lands, see repository section below). If null, use `Date.now() - 90 * 24 * 3600 * 1000` (D-04's 90-day backfill). Build the Graph `$filter` on `sentDateTime ge {watermarkIso}` against **`/me/mailfolders/sentitems/messages`** (D-06 — not `/me/calendarview`).
- Graph query params differ: use `$filter`, `$orderby=sentDateTime`, `$top` and follow `@odata.nextLink` for pagination (Claude's Discretion note in CONTEXT.md — calendar sync does NOT paginate, since its window is capped at `$top: 250`; email sync must implement standard nextLink looping since 90-day backfill can exceed one page).
- Reuse `this.ensureFreshToken()` (private method, same class) as-is — no changes needed (CONTEXT.md "Reusable Assets").
- Client matching (D-07/D-08/D-09) happens between the Graph fetch and the repository upsert call — see new `email.repository.ts` section below for where domain-matching logic should live.
- After upsert, call `recordEvent()` with a new verb `integration.emails_synced` (mirrors `integration.calendar_synced` exactly), then update the watermark to "now" (or to the latest `sentDateTime` seen) via a repository call.
- Return shape: `{ synced: number; skipped?: string }` — identical contract to `syncCalendar()`.

**Imports pattern** (lines 1-7, same file — reuse, extend if a new repository file is added):
```typescript
import jwt from 'jsonwebtoken';
import { AppError } from '../../core/errors/AppError';
import { recordEvent } from '../../core/events/activityLog';
import { outlookRepository } from './outlook.repository';
import { calendarRepository, type UpsertCalendarEventInput } from './calendar.repository';
import { projectsRepository } from '../projects/projects.repository';
import { OutlookStatus, OutlookCredentials } from './outlook.types';
// ADD: import { emailRepository, type UpsertEmailMessageInput } from './email.repository';
```

**Token refresh pattern to reuse as-is** (lines 216-247):
```typescript
private async ensureFreshToken(companyId: string, creds: OutlookCredentials): Promise<OutlookCredentials> {
    if (!creds.expires_at || creds.expires_at > Date.now() + 60_000) return creds;
    if (!creds.refresh_token) return creds;
    const cfg = msConfig();
    if (!cfg.configured) return creds;
    // ... token refresh POST, persists via outlookRepository.upsert() ...
}
```

---

### `apps/api/src/domains/outlook/outlook.repository.ts` — extend for watermark

**Analog:** `find()` / `upsert()`, same file, lines 14-38

**Existing pattern** (lines 14-38):
```typescript
class OutlookRepository {
  async find(companyId: string): Promise<{ status: string; creds: OutlookCredentials; connected_at: Date | null } | null> {
    const { rows } = await db.query<ConnectionRow>(
      `SELECT status, credentials_json, connected_at
       FROM integration_credentials WHERE company_id = $1 AND provider_id = $2`,
      [companyId, PROVIDER],
    );
    if (rows.length === 0) return null;
    let creds: OutlookCredentials = { demo: false, email: null };
    try { creds = JSON.parse(decryptSecret(rows[0].credentials_json)); } catch { /* keep default */ }
    return { status: rows[0].status, creds, connected_at: rows[0].connected_at };
  }

  async upsert(companyId: string, creds: OutlookCredentials): Promise<void> {
    await db.query(
      `INSERT INTO integration_credentials
         (company_id, provider_id, credentials_json, status, connected_at, updated_at)
       VALUES ($1, $2, $3, 'connected', NOW(), NOW())
       ON CONFLICT (company_id, provider_id)
       DO UPDATE SET credentials_json = EXCLUDED.credentials_json,
                     status = 'connected', connected_at = NOW(), updated_at = NOW(),
                     sync_error = NULL`,
      [companyId, PROVIDER, encryptSecret(JSON.stringify(creds))],
    );
  }
```

**Important discovery:** `integration_credentials` (defined in `database/extensions.sql` lines 68-80) **already has a `last_sync_at TIMESTAMP WITH TIME ZONE` column** — this is the natural home for D-05's watermark. No new migration column is strictly required for the watermark itself; only the `email_messages` UNIQUE constraint change (D-07) needs a new migration.

**Recommended additions to `OutlookRepository`:**
- `findWithWatermark(companyId)` or extend `find()`'s return to also select `last_sync_at` — add it to the `ConnectionRow` interface and the SELECT list, and to the returned object.
- `updateLastSyncAt(companyId: string, at: Date): Promise<void>` — a small `UPDATE integration_credentials SET last_sync_at = $1 WHERE company_id = $2 AND provider_id = $3` (mirrors `disconnect()`'s single-purpose UPDATE at lines 40-47).
- `listConnectedMailboxes(): Promise<{ company_id, credentials_json, last_sync_at }[]>` — new method, mirrors telematics' `fetchActiveIntegrations()` (see worker section) but filtered to `provider_id = 'outlook' AND status = 'connected'`, excluding demo-mode rows (`credentials_json` decrypt check, or simpler: skip demo in the service loop as `syncCalendar()` already does per-company).

---

### `apps/api/src/domains/outlook/outlook.types.ts` — extend `OutlookCredentials`/status shape

**Analog:** `OutlookCredentials` interface, lines 14-21
```typescript
export interface OutlookCredentials {
  demo: boolean;
  email: string | null;
  access_token?: string;
  refresh_token?: string;
  expires_at?: number; // epoch ms
  scope?: string;
}
```
No change needed to this interface itself (watermark lives in `integration_credentials.last_sync_at`, a separate DB column, not inside the encrypted JSON blob). Add a new exported type near `CalendarEvent` (lines 24-37) for the email-sync equivalent, e.g. `EmailMessage` interface mirroring the `email_messages` table columns (see migration section) — same shape convention as `CalendarEvent`.

---

### New: `apps/api/src/domains/outlook/email.repository.ts`

**Analog:** `apps/api/src/domains/outlook/calendar.repository.ts`, full file (63 lines)

**Full upsert pattern to copy and adapt** (lines 1-33):
```typescript
import { db } from '../../core/db';
import { CalendarEvent } from './outlook.types';

export interface UpsertCalendarEventInput {
  external_id: string;
  project_id: string | null;
  subject: string | null;
  start_at: string; // ISO
  end_at: string;   // ISO
  is_all_day: boolean;
  categories: string[];
  attendee_emails: string[];
}

class CalendarRepository {
  async upsertEvents(companyId: string, events: UpsertCalendarEventInput[]): Promise<void> {
    for (const e of events) {
      await db.query(
        `INSERT INTO calendar_events
           (company_id, project_id, external_id, subject, start_at, end_at, is_all_day, categories, attendee_emails, synced_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
         ON CONFLICT (company_id, external_id)
         DO UPDATE SET project_id = EXCLUDED.project_id, subject = EXCLUDED.subject,
                        start_at = EXCLUDED.start_at, end_at = EXCLUDED.end_at,
                        is_all_day = EXCLUDED.is_all_day, categories = EXCLUDED.categories,
                        attendee_emails = EXCLUDED.attendee_emails, synced_at = NOW()`,
        [
          companyId, e.project_id, e.external_id, e.subject, e.start_at, e.end_at,
          e.is_all_day, e.categories, e.attendee_emails,
        ],
      );
    }
  }
}
export const calendarRepository = new CalendarRepository();
```

**Adaptation notes for `email.repository.ts`:**
- Conflict target changes: `ON CONFLICT (company_id, outlook_id)` → `ON CONFLICT (company_id, outlook_id, client_id)` per D-07 (requires the new migration below).
- `UpsertEmailMessageInput` should carry: `client_id` (matched client, non-null per row since D-07 makes one row per matched client — the existing table's `client_id` column is nullable today but every synced row will have one), `outlook_id`, `sender_email`, `recipient_emails: string[]`, `subject`, `body_preview`, `received_at`, `is_draft`.
- One Graph message → N client matches (D-07) means the service builds N insert objects per message (one per matched `client_id`) *before* calling the repository's upsert-many method — same "loop and upsert" structure as `upsertEvents()`, just with more rows fed in from the mapping step.
- Loop-per-row `INSERT ... ON CONFLICT` (not a single batched multi-row VALUES) matches `calendar.repository.ts`'s style exactly — keep this for consistency rather than switching to the multi-row VALUES style seen in `telematics.worker.ts`'s `persistLocations()` (lines 141-154), since this domain's existing sibling file (`calendar.repository.ts`) is the more direct analog.
- Read side: `apps/api/src/domains/crm/crm.repository.ts` already has `listClientEmails()` (lines 164-173) reading from `email_messages` — no read-repository work needed this phase; that's the phase-6+ consumer path CONTEXT.md references.

**Domain-matching helper (D-08/D-09):** No existing analog in the codebase (confirmed — no domain-matching or denylist code found via search). This is new logic; keep it as a small pure function (e.g. exported from `email.repository.ts` or a sibling `email.matcher.ts`), taking `(recipientEmails: string[], clients: {id, email}[])` and returning matched `client_id[]`. Source client list via the existing `crm.repository.ts` `listClients(companyId)` pattern (lines 22-24):
```typescript
async listClients(companyId: string): Promise<ClientRecord[]> {
    const { rows } = await db.query<ClientRecord>(
      `SELECT * FROM clients WHERE company_id = $1 ORDER BY name ASC`, [companyId]);
    return rows;
}
```

---

### New: BullMQ scheduler — mirrors `scheduleTelematicsSync()` + `startTelematicsWorker()`

**Analog:** `apps/api/src/workers/telematics.worker.ts`, lines 232-299 (full worker + scheduler section)

**Repeatable-job scheduler pattern to copy** (lines 283-299):
```typescript
export async function scheduleTelematicsSync(): Promise<void> {
  const { getQueue } = await import('../core/queue');
  const queue = getQueue('telematics');

  await queue.add(
    'sync',
    {},
    {
      repeat: { every: 5 * 60 * 1000 }, // every 5 minutes
      jobId:  'telematics-sync-repeatable',
      removeOnComplete: { count: 10 },
      removeOnFail:     { count: 5 },
    },
  );

  console.log('[Telematics] Repeatable sync job scheduled (every 5 min)');
}
```
**Adapt as:** `scheduleEmailSync()` in a new `apps/api/src/workers/email.worker.ts` (or added to an existing outlook-related worker file if one exists — none found; create new), with `repeat: { every: 15 * 60 * 1000 }` (D-02) and `jobId: 'email-sync-repeatable'` (naming convention per CONTEXT.md discretion note, mirroring `telematics-sync-repeatable`).

**Worker + single-job-iterates-all-companies pattern** (lines 232-256, adapt the loop shape):
```typescript
export const startTelematicsWorker = (): Worker => {
  const worker = new Worker<TelematicsSyncPayload>(
    'telematics',
    async (_job: Job<TelematicsSyncPayload>) => {
      console.log('[Telematics] Starting location sweep…');
      const integrations = await fetchActiveIntegrations();
      if (integrations.length === 0) {
        console.log('[Telematics] No active telematics integrations — skipping sweep');
        return;
      }
      await Promise.allSettled(
        integrations.map((integration, idx) => sweepCompany(integration, idx)),
      );
      console.log(`[Telematics] Sweep complete — processed ${integrations.length} integration(s)`);
    },
    { connection: queueConnection, concurrency: 1 },
  );

  worker.on('completed', (job) => console.log(`[Telematics] Job ${job.id} completed`));
  worker.on('failed', (job, err) => console.error(`[Telematics] Job ${job?.id ?? 'unknown'} failed: ${err.message}`));
  worker.on('error', (err) => console.error('[Telematics] Worker-level error:', err.message));
  return worker;
};
```
**Adapt as:** the email-sync worker's job processor should call `outlookRepository.listConnectedMailboxes()` (new method, see repository section) instead of `fetchActiveIntegrations()`, then loop calling `outlookService.syncEmails(companyId, null)` per company via `Promise.allSettled` — **critically, `syncEmails()` itself never throws** (D-10's silent-skip contract, same as `syncCalendar()`), so `Promise.allSettled` is defense-in-depth, not the primary resilience mechanism.

**Company-list query pattern to adapt** (lines 117-125 — this is the direct analog for "iterate all companies with a connected mailbox"):
```typescript
async function fetchActiveIntegrations(): Promise<ActiveIntegration[]> {
  const { rows } = await db.query<ActiveIntegration>(
    `SELECT company_id, provider, credentials_json
     FROM api_credentials
     WHERE provider IN ('samsara', 'geotab')
       AND status = 'active'`,
  );
  return rows;
}
```
Adapt table/filter to `integration_credentials WHERE provider_id = 'outlook' AND status = 'connected'` (this table, not `api_credentials` — outlook already uses `integration_credentials`, confirmed in `outlook.repository.ts`).

**Bootstrap wiring:** `scheduleTelematicsSync()` is called once at app startup per its own doc comment (lines 274-281: "Call this once at application startup (e.g., in src/index.ts)"). Search `apps/api/src/index.ts` (or `server.ts`) for the actual call site before wiring `scheduleEmailSync()` similarly — not read in this pass, but the doc comment gives the exact integration point convention.

---

## Shared Patterns

### Silent-skip / never-throw contract (D-10 — the single most important pattern)
**Source:** `syncCalendar()`, `apps/api/src/domains/outlook/outlook.service.ts` lines 164-170
**Apply to:** `syncEmails()` — every guard clause returns `{ synced: 0, skipped: 'reason' }` instead of throwing:
```typescript
const conn = await outlookRepository.find(companyId);
if (!conn || conn.status !== 'connected') return { synced: 0, skipped: 'not connected' };
if (conn.creds.demo) return { synced: 0, skipped: 'demo mode has no real calendar to sync' };
const creds = await this.ensureFreshToken(companyId, conn.creds);
if (!creds.access_token) return { synced: 0, skipped: 'no access token' };
// ... and on Graph fetch failure:
if (!res.ok) return { synced: 0, skipped: `Graph calendarview failed (${res.status})` };
```

### Audit trail via `recordEvent()`
**Source:** `apps/api/src/core/events/activityLog.ts` lines 22-41; called at `outlook.service.ts` lines 209-212
**Apply to:** `syncEmails()`, after successful upsert:
```typescript
await recordEvent({
  tenantId: companyId, actorId, verb: 'integration.emails_synced',
  objectType: 'integration', payload: { provider: 'outlook', count: <rows written> },
});
```
Note `recordEvent()` itself never throws (try/catch internally, logs to console on failure) — safe to call unconditionally.

### Queue singleton registry
**Source:** `apps/api/src/core/queue/index.ts` lines 31-36
**Apply to:** the new email-sync scheduler — call `getQueue('email-sync')` (or similar queue name), never `new Queue(...)` directly:
```typescript
export function getQueue(name: string): Queue {
  if (!queues.has(name)) {
    queues.set(name, new Queue(name, { connection }));
  }
  return queues.get(name)!;
}
```

### Idempotent migration header/style
**Source:** `database/migrations/021_crm_extensions.sql` lines 1-18 (header comment convention) and body (uses `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `DO $$ ... IF NOT EXISTS ... END $$` for constraints)
**Apply to:** new migration file for D-07's UNIQUE constraint change on `email_messages`:
```sql
-- Migration: relax email_messages uniqueness to (company_id, outlook_id, client_id)
-- so one Graph sent-mail message can map to N client-scoped rows. Idempotent.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'email_messages_company_id_outlook_id_key'
  ) THEN
    ALTER TABLE email_messages DROP CONSTRAINT email_messages_company_id_outlook_id_key;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS email_messages_company_outlook_client_uniq
  ON email_messages (company_id, outlook_id, client_id);
```
Note: the exact auto-generated constraint name (`email_messages_company_id_outlook_id_key`) should be verified against the actual DB before relying on it — Postgres's default naming for an inline `UNIQUE (...)` clause follows `{table}_{col1}_{col2}_key`, but confirm at execution time (e.g. via `\d email_messages` or querying `pg_constraint`) rather than assuming.

## No Analog Found

| File/Concern | Role | Data Flow | Reason |
|---|---|---|---|
| Domain-based client-matching logic (D-08/D-09, denylist + domain-split) | utility (transform) | transform | No existing email/domain-matching code anywhere in the codebase (confirmed via search) — this is genuinely new logic. Write as a small, easily-unit-testable pure function; no analog to copy structurally, only the data source (`crm.repository.ts` `listClients()`) is reused. |
| Graph pagination (`@odata.nextLink` looping) | utility (transform/fetch) | streaming/batch | `syncCalendar()` does not paginate (its window is capped via `$top: 250` and a bounded date range). No existing Graph pagination loop found in the codebase to copy — implement standard `while (nextLink) { fetch(nextLink); ... }` looping as called out in CONTEXT.md's discretion note. |

## Metadata

**Analog search scope:** `apps/api/src/domains/outlook/`, `apps/api/src/domains/crm/`, `apps/api/src/workers/`, `apps/api/src/core/queue/`, `apps/api/src/core/events/`, `database/migrations/`, `database/extensions.sql`
**Files scanned:** 12 read in full or targeted sections (outlook.service.ts, outlook.repository.ts, outlook.types.ts, calendar.repository.ts, outlook.routes.ts, queue/index.ts, activityLog.ts, telematics.worker.ts, 021_crm_extensions.sql, 019_crm_billing.sql, extensions.sql, crm.repository.ts)
**Pattern extraction date:** 2026-07-06
