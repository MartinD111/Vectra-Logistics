import { test, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../db';
import {
  claimDueEvents,
  dispatchDueEvents,
  EventOutboxRow,
  markEventPublishFailed,
  publishDurableEvent,
} from './outbox';

afterEach(() => {
  mock.restoreAll();
});

function makeOutboxRow(overrides: Partial<EventOutboxRow> = {}): EventOutboxRow {
  return {
    id: 'outbox-1',
    tenant_id: 'company-1',
    event_id: '11111111-1111-4111-8111-111111111111',
    event_name: 'records.collection.created',
    envelope_version: 1,
    actor_id: 'user-1',
    object_type: 'data_collection',
    object_id: '22222222-2222-4222-8222-222222222222',
    project_id: null,
    causation_id: null,
    correlation_id: 'request-1',
    payload_version: 1,
    payload: { collection: { id: 'collection-1', name: 'Clients' }, defaultView: { id: 'view-1', type: 'table' } },
    status: 'publishing',
    attempts: 1,
    max_attempts: 3,
    next_attempt_at: new Date(),
    locked_at: new Date(),
    locked_by: 'worker-1',
    published_at: null,
    failed_at: null,
    last_error: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

test('claimDueEvents uses database state to claim pending and stale publishing rows safely', async () => {
  let capturedSql = '';
  let capturedParams: unknown[] = [];
  mock.method(db, 'query', async (sql: string, params: unknown[]) => {
    capturedSql = sql;
    capturedParams = params;
    return { rows: [makeOutboxRow()] };
  });

  const rows = await claimDueEvents('worker-1', 10);

  assert.equal(rows.length, 1);
  assert.match(capturedSql, /FOR UPDATE SKIP LOCKED/);
  assert.match(capturedSql, /attempts = e\.attempts \+ 1/);
  assert.match(capturedSql, /status = 'publishing'/);
  assert.deepEqual(capturedParams, [10, 'worker-1']);
});

test('publishDurableEvent projects records.collection.created into activity_events before marking published', async () => {
  const calls: { sql: string; params?: unknown[] }[] = [];
  const fakeClient = {
    query: async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params });
      return { rows: [] };
    },
    release: mock.fn(),
  };
  mock.method(db, 'connect', async () => fakeClient);

  await publishDurableEvent(makeOutboxRow());

  assert.equal(calls[0].sql, 'BEGIN');
  assert.match(calls[1].sql, /INSERT INTO activity_events/);
  assert.equal(calls[1].params?.[2], 'records.collection.created');
  assert.match(calls[1].params?.[6] as string, /durable_event_id/);
  assert.match(calls[2].sql, /UPDATE event_outbox/);
  assert.match(calls[2].sql, /status = 'published'/);
  assert.equal(calls[3].sql, 'COMMIT');
  assert.equal(fakeClient.release.mock.calls.length, 1);
});

test('markEventPublishFailed schedules retry until max attempts, then persists terminal failure', async () => {
  const calls: { params?: unknown[] }[] = [];
  mock.method(db, 'query', async (_sql: string, params: unknown[]) => {
    calls.push({ params });
    return { rows: [] };
  });

  await markEventPublishFailed(makeOutboxRow({ attempts: 1, max_attempts: 3 }), new Error('temporary'));
  await markEventPublishFailed(makeOutboxRow({ attempts: 3, max_attempts: 3 }), new Error('terminal'));

  assert.equal(calls[0].params?.[1], 'pending');
  assert.equal(calls[1].params?.[1], 'failed');
  assert.equal(calls[1].params?.[3], 'terminal');
});

test('dispatchDueEvents reports published and retry/failed outcomes from persisted attempt state', async () => {
  const first = makeOutboxRow({ id: 'outbox-1', attempts: 1, max_attempts: 3 });
  const second = makeOutboxRow({ id: 'outbox-2', attempts: 3, max_attempts: 3 });
  mock.method(db, 'query', async (sql: string) => {
    if (/WITH due/.test(sql)) return { rows: [first, second] };
    return { rows: [] };
  });
  let publishCalls = 0;
  const fakeClient = {
    query: async (sql: string) => {
      if (/INSERT INTO activity_events/.test(sql)) {
        publishCalls += 1;
        if (publishCalls === 2) throw new Error('projection failed');
      }
      return { rows: [] };
    },
    release: mock.fn(),
  };
  mock.method(db, 'connect', async () => fakeClient);

  const result = await dispatchDueEvents('worker-1', 10);

  assert.deepEqual(result, { claimed: 2, published: 1, failed: 1, retryScheduled: 0 });
});
