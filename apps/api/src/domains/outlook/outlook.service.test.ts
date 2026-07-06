import { test, mock, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { outlookService } from './outlook.service';
import { outlookRepository } from './outlook.repository';
import { emailRepository } from './email.repository';
import { crmRepository } from '../crm/crm.repository';
import * as activityLog from '../../core/events/activityLog';

const CONNECTED_DEMO_FALSE = {
  status: 'connected',
  creds: { demo: false, email: 'me@company.com', access_token: 'tok', expires_at: Date.now() + 3600_000 },
  connected_at: new Date(),
  last_sync_at: new Date('2026-01-01T00:00:00Z'),
};

let originalFetch: typeof fetch;

beforeEach(() => {
  originalFetch = global.fetch;
});

afterEach(() => {
  mock.restoreAll();
  global.fetch = originalFetch;
});

test('not connected -> skipped without calling fetch', async () => {
  mock.method(outlookRepository, 'find', async () => ({ ...CONNECTED_DEMO_FALSE, status: 'disconnected' }));
  const fetchMock = mock.fn();
  global.fetch = fetchMock as unknown as typeof fetch;

  const result = await outlookService.syncEmails('company-1', null);

  assert.deepEqual(result, { synced: 0, skipped: 'not connected' });
  assert.equal(fetchMock.mock.calls.length, 0);
});

test('demo mode -> skipped without calling fetch', async () => {
  mock.method(outlookRepository, 'find', async () => ({
    ...CONNECTED_DEMO_FALSE,
    creds: { ...CONNECTED_DEMO_FALSE.creds, demo: true },
  }));
  const fetchMock = mock.fn();
  global.fetch = fetchMock as unknown as typeof fetch;

  const result = await outlookService.syncEmails('company-1', null);

  assert.deepEqual(result, { synced: 0, skipped: 'demo mode has no real mailbox to sync' });
  assert.equal(fetchMock.mock.calls.length, 0);
});

test('no access token -> skipped', async () => {
  mock.method(outlookRepository, 'find', async () => ({
    ...CONNECTED_DEMO_FALSE,
    creds: { demo: false, email: 'me@company.com' }, // no access_token, no refresh_token
  }));

  const result = await outlookService.syncEmails('company-1', null);

  assert.deepEqual(result, { synced: 0, skipped: 'no access token' });
});

test('follows @odata.nextLink and aggregates both pages', async () => {
  mock.method(outlookRepository, 'find', async () => CONNECTED_DEMO_FALSE);
  mock.method(outlookRepository, 'updateLastSyncAt', async () => {});
  mock.method(crmRepository, 'listClients', async () => [
    { id: 'c1', email: 'a@acme.com' } as any,
  ]);
  const upsertMock = mock.method(emailRepository, 'upsertMessages', async () => {});
  mock.method(activityLog, 'recordEvent', async () => {});

  let call = 0;
  global.fetch = (async () => {
    call += 1;
    if (call === 1) {
      return {
        ok: true,
        json: async () => ({
          value: [{
            id: 'm1', subject: 'Hi', sentDateTime: '2026-02-01T10:00:00Z', isDraft: false,
            from: { emailAddress: { address: 'me@company.com' } },
            toRecipients: [{ emailAddress: { address: 'x@acme.com' } }],
            ccRecipients: [],
            bodyPreview: 'preview',
          }],
          '@odata.nextLink': 'https://graph.microsoft.com/v1.0/next-page',
        }),
      } as unknown as Response;
    }
    return {
      ok: true,
      json: async () => ({
        value: [{
          id: 'm2', subject: 'Hi again', sentDateTime: '2026-02-02T10:00:00Z', isDraft: false,
          from: { emailAddress: { address: 'me@company.com' } },
          toRecipients: [{ emailAddress: { address: 'y@acme.com' } }],
          ccRecipients: [],
          bodyPreview: 'preview 2',
        }],
      }),
    } as unknown as Response;
  }) as unknown as typeof fetch;

  const result = await outlookService.syncEmails('company-1', null);

  assert.equal(result.synced, 2);
  assert.equal(upsertMock.mock.calls.length, 1);
  const upsertedRows = upsertMock.mock.calls[0].arguments[1] as { outlook_id: string }[];
  assert.equal(upsertedRows.length, 2);
});

test('one message matching two clients produces two rows with the same outlook_id', async () => {
  mock.method(outlookRepository, 'find', async () => CONNECTED_DEMO_FALSE);
  mock.method(outlookRepository, 'updateLastSyncAt', async () => {});
  mock.method(crmRepository, 'listClients', async () => [
    { id: 'c1', email: 'a@acme.com' } as any,
    { id: 'c2', email: 'b@beta.com' } as any,
  ]);
  const upsertMock = mock.method(emailRepository, 'upsertMessages', async () => {});
  mock.method(activityLog, 'recordEvent', async () => {});

  global.fetch = (async () => ({
    ok: true,
    json: async () => ({
      value: [{
        id: 'm1', subject: 'Broadcast', sentDateTime: '2026-02-01T10:00:00Z', isDraft: false,
        from: { emailAddress: { address: 'me@company.com' } },
        toRecipients: [
          { emailAddress: { address: 'x@acme.com' } },
          { emailAddress: { address: 'y@beta.com' } },
        ],
        ccRecipients: [],
        bodyPreview: 'preview',
      }],
    }),
  } as unknown as Response)) as unknown as typeof fetch;

  const result = await outlookService.syncEmails('company-1', null);

  assert.equal(result.synced, 2);
  const rows = upsertMock.mock.calls[0].arguments[1] as { outlook_id: string; client_id: string }[];
  assert.equal(rows.length, 2);
  assert.deepEqual(new Set(rows.map((r) => r.client_id)), new Set(['c1', 'c2']));
  assert.ok(rows.every((r) => r.outlook_id === 'm1'));
});

test('on success updates watermark and records emails_synced event', async () => {
  mock.method(outlookRepository, 'find', async () => CONNECTED_DEMO_FALSE);
  const updateLastSyncAtMock = mock.method(outlookRepository, 'updateLastSyncAt', async () => {});
  mock.method(crmRepository, 'listClients', async () => []);
  mock.method(emailRepository, 'upsertMessages', async () => {});
  const recordEventMock = mock.method(activityLog, 'recordEvent', async () => {});

  global.fetch = (async () => ({
    ok: true,
    json: async () => ({ value: [] }),
  } as unknown as Response)) as unknown as typeof fetch;

  const result = await outlookService.syncEmails('company-1', 'user-1');

  assert.equal(result.synced, 0);
  assert.equal(updateLastSyncAtMock.mock.calls.length, 1);
  assert.equal(updateLastSyncAtMock.mock.calls[0].arguments[0], 'company-1');
  assert.ok(updateLastSyncAtMock.mock.calls[0].arguments[1] instanceof Date);
  assert.equal(recordEventMock.mock.calls.length, 1);
  const eventArg = recordEventMock.mock.calls[0]!.arguments[0]!;
  assert.equal(eventArg.verb, 'integration.emails_synced');
});
