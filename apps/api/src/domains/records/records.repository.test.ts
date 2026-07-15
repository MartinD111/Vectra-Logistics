import { test, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../../core/db';
import { recordsRepository } from './records.repository';

afterEach(() => {
  mock.restoreAll();
});

test('createCollectionWithDefaultView runs BEGIN, inserts collection/view/outbox event, COMMIT, then releases the client', async () => {
  const calls: { sql: string; params?: unknown[] }[] = [];
  const fakeClient = {
    query: async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params });
      if (/INSERT INTO data_collections/.test(sql)) {
        return { rows: [{ id: 'collection-1', company_id: 'company-1', project_id: null, name: 'My Collection', schema: [], created_by: null, created_at: new Date(), updated_at: new Date() }] };
      }
      if (/INSERT INTO collection_views/.test(sql)) {
        return { rows: [{ id: 'view-1', company_id: 'company-1', collection_id: 'collection-1', name: 'Table', type: 'table', config: {}, sort_order: 0, created_at: new Date() }] };
      }
      if (/INSERT INTO event_outbox/.test(sql)) {
        return { rows: [{ id: 'outbox-1', tenant_id: 'company-1', event_id: params?.[0], event_name: 'records.collection.created', envelope_version: 1, actor_id: 'user-1', object_type: 'data_collection', object_id: 'collection-1', project_id: null, causation_id: null, correlation_id: 'request-1', payload_version: 1, payload: {}, status: 'pending', attempts: 0, max_attempts: 5, next_attempt_at: new Date(), locked_at: null, locked_by: null, published_at: null, failed_at: null, last_error: null, created_at: new Date(), updated_at: new Date() }] };
      }
      return { rows: [] };
    },
    release: mock.fn(),
  };
  mock.method(db, 'connect', async () => fakeClient);

  const result = await recordsRepository.createCollectionWithDefaultView('company-1', {
    name: 'My Collection', schema: [], createdBy: 'user-1', actorId: 'user-1', correlationId: 'request-1',
  });

  assert.equal(calls[0].sql, 'BEGIN');
  assert.match(calls[1].sql, /INSERT INTO data_collections/);
  assert.match(calls[2].sql, /INSERT INTO collection_views/);
  const viewParamsIncludeTable = calls[2].sql.includes("'table'") || (calls[2].params ?? []).includes('table');
  assert.ok(viewParamsIncludeTable, 'default view insert must specify type table');
  assert.match(calls[3].sql, /INSERT INTO event_outbox/);
  assert.deepEqual(calls[3].params?.slice(1, 11), [
    'company-1',
    'records.collection.created',
    1,
    'user-1',
    'data_collection',
    'collection-1',
    null,
    null,
    'request-1',
    1,
  ]);
  assert.match(calls[3].params?.[11] as string, /"defaultView"/);
  assert.equal(calls[4].sql, 'COMMIT');
  assert.equal(fakeClient.release.mock.calls.length, 1);
  assert.equal(result.collection.id, 'collection-1');
  assert.equal(result.view.id, 'view-1');
});

test('createCollectionWithDefaultView rolls back and re-throws when the view insert fails', async () => {
  const calls: { sql: string; params?: unknown[] }[] = [];
  const fakeClient = {
    query: async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params });
      if (/INSERT INTO data_collections/.test(sql)) {
        return { rows: [{ id: 'collection-1', company_id: 'company-1', project_id: null, name: 'My Collection', schema: [], created_by: null, created_at: new Date(), updated_at: new Date() }] };
      }
      if (/INSERT INTO collection_views/.test(sql)) {
        throw new Error('insert failed');
      }
      return { rows: [] };
    },
    release: mock.fn(),
  };
  mock.method(db, 'connect', async () => fakeClient);

  await assert.rejects(
    recordsRepository.createCollectionWithDefaultView('company-1', { name: 'My Collection', schema: [], createdBy: 'user-1' }),
    /insert failed/,
  );

  assert.ok(calls.some((c) => c.sql === 'ROLLBACK'));
  assert.equal(fakeClient.release.mock.calls.length, 1);
});

test('listChildren scopes by parent_record_id and company_id, ordered by sort_order then created_at', async () => {
  let capturedSql = '';
  let capturedParams: unknown[] = [];
  mock.method(db, 'query', async (sql: string, params: unknown[]) => {
    capturedSql = sql;
    capturedParams = params;
    return { rows: [] };
  });

  await recordsRepository.listChildren('parent-1', 'company-1');

  assert.match(capturedSql, /parent_record_id = \$1/);
  assert.match(capturedSql, /company_id = \$2/);
  assert.match(capturedSql, /ORDER BY sort_order ASC, created_at ASC/);
  assert.deepEqual(capturedParams, ['parent-1', 'company-1']);
});

test('createRecord passes props and body as JSON.stringify()d parameters, never inlined into SQL text', async () => {
  let capturedSql = '';
  let capturedParams: unknown[] = [];
  mock.method(db, 'query', async (sql: string, params: unknown[]) => {
    capturedSql = sql;
    capturedParams = params;
    return { rows: [{ id: 'record-1', company_id: 'company-1', collection_id: 'collection-1', parent_record_id: null, props: {}, body: {}, sort_order: 0, created_by: null, created_at: new Date(), updated_at: new Date() }] };
  });

  const props = { name: 'Alice' };
  const body = { version: 1, blocks: [] };
  await recordsRepository.createRecord('company-1', {
    collectionId: 'collection-1', parentRecordId: null, props, body, createdBy: 'user-1',
  });

  const propsParam = capturedParams.find((p) => typeof p === 'string' && p.includes('Alice'));
  assert.equal(propsParam, JSON.stringify(props));
  const bodyParam = capturedParams.find((p) => typeof p === 'string' && p.includes('blocks'));
  assert.equal(bodyParam, JSON.stringify(body));
  assert.doesNotMatch(capturedSql, /Alice/);
});

test('findCollection returns null (not throwing) when no row matches', async () => {
  mock.method(db, 'query', async () => ({ rows: [] }));

  const result = await recordsRepository.findCollection('missing-id', 'company-1');

  assert.equal(result, null);
});

test('listViews scopes by collection_id and company_id', async () => {
  let capturedSql = '';
  let capturedParams: unknown[] = [];
  mock.method(db, 'query', async (sql: string, params: unknown[]) => {
    capturedSql = sql;
    capturedParams = params;
    return { rows: [] };
  });

  await recordsRepository.listViews('collection-1', 'company-1');

  assert.match(capturedSql, /collection_id = \$1 AND company_id = \$2/);
  assert.deepEqual(capturedParams, ['collection-1', 'company-1']);
});
