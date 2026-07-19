import { test, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import type { PoolClient } from 'pg';
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

// HIER-04 Test 1: archiveCollectionsInFolders filters on company_id, folder_id set,
// and archived_at IS NULL; sets archived_at = NOW() using the passed-in client.
test('archiveCollectionsInFolders scopes by company_id, folder_id set, and archived_at IS NULL', async () => {
  let capturedSql = '';
  let capturedParams: unknown[] = [];
  const fakeClient = {
    query: async (sql: string, params: unknown[]) => {
      if (/UPDATE data_collections/.test(sql)) {
        capturedSql = sql;
        capturedParams = params;
        return {
          rows: [{
            id: 'collection-1', company_id: 'company-1', project_id: null, folder_id: 'folder-1',
            name: 'My Collection', schema: [], created_by: null, created_at: new Date(),
            updated_at: new Date(), archived_at: new Date(),
          }],
        };
      }
      if (/INSERT INTO event_outbox/.test(sql)) {
        return {
          rows: [{
            id: 'outbox-1', tenant_id: 'company-1', event_id: params?.[0], event_name: 'data_collection.archived',
            envelope_version: 1, actor_id: null, object_type: 'data_collection', object_id: 'collection-1',
            project_id: null, causation_id: null, correlation_id: null, payload_version: 1, payload: {},
            status: 'pending', attempts: 0, max_attempts: 5, next_attempt_at: new Date(), locked_at: null,
            locked_by: null, published_at: null, failed_at: null, last_error: null, created_at: new Date(),
            updated_at: new Date(),
          }],
        };
      }
      return { rows: [] };
    },
  } as unknown as PoolClient;

  const result = await recordsRepository.archiveCollectionsInFolders(fakeClient, ['folder-1', 'folder-2'], 'company-1');

  assert.match(capturedSql, /company_id = \$1/);
  assert.match(capturedSql, /folder_id = ANY\(\$2::uuid\[\]\)/);
  assert.match(capturedSql, /archived_at IS NULL/);
  assert.match(capturedSql, /SET archived_at = NOW\(\)/);
  assert.deepEqual(capturedParams, ['company-1', ['folder-1', 'folder-2']]);
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'collection-1');
});

// HIER-04 Test 2: archiveCollectionsInProjects filters independently by project_id
// (Pitfall 5 pass 2), catching collections attached via project_id only.
test('archiveCollectionsInProjects scopes by company_id and project_id set, independent of folder_id', async () => {
  let capturedSql = '';
  let capturedParams: unknown[] = [];
  const fakeClient = {
    query: async (sql: string, params: unknown[]) => {
      if (/UPDATE data_collections/.test(sql)) {
        capturedSql = sql;
        capturedParams = params;
        return {
          rows: [{
            id: 'collection-2', company_id: 'company-1', project_id: 'project-1', folder_id: null,
            name: 'Project-only Collection', schema: [], created_by: null, created_at: new Date(),
            updated_at: new Date(), archived_at: new Date(),
          }],
        };
      }
      if (/INSERT INTO event_outbox/.test(sql)) {
        return {
          rows: [{
            id: 'outbox-2', tenant_id: 'company-1', event_id: params?.[0], event_name: 'data_collection.archived',
            envelope_version: 1, actor_id: null, object_type: 'data_collection', object_id: 'collection-2',
            project_id: 'project-1', causation_id: null, correlation_id: null, payload_version: 1, payload: {},
            status: 'pending', attempts: 0, max_attempts: 5, next_attempt_at: new Date(), locked_at: null,
            locked_by: null, published_at: null, failed_at: null, last_error: null, created_at: new Date(),
            updated_at: new Date(),
          }],
        };
      }
      return { rows: [] };
    },
  } as unknown as PoolClient;

  const result = await recordsRepository.archiveCollectionsInProjects(fakeClient, ['project-1'], 'company-1');

  assert.match(capturedSql, /company_id = \$1/);
  assert.match(capturedSql, /project_id = ANY\(\$2::uuid\[\]\)/);
  assert.match(capturedSql, /archived_at IS NULL/);
  assert.deepEqual(capturedParams, ['company-1', ['project-1']]);
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'collection-2');
});

// HIER-04 Test 3: unarchiveCollection restores archived_at to NULL, or returns
// null if the row doesn't exist for that company.
test('unarchiveCollection sets archived_at to NULL and returns the updated row', async () => {
  let capturedSql = '';
  let capturedParams: unknown[] = [];
  mock.method(db, 'query', async (sql: string, params: unknown[]) => {
    capturedSql = sql;
    capturedParams = params;
    return {
      rows: [{
        id: 'collection-1', company_id: 'company-1', project_id: null, folder_id: 'folder-1',
        name: 'My Collection', schema: [], created_by: null, created_at: new Date(),
        updated_at: new Date(), archived_at: null,
      }],
    };
  });

  const result = await recordsRepository.unarchiveCollection('collection-1', 'company-1');

  assert.match(capturedSql, /SET archived_at = NULL/);
  assert.match(capturedSql, /WHERE id = \$1 AND company_id = \$2/);
  assert.deepEqual(capturedParams, ['collection-1', 'company-1']);
  assert.equal(result?.archived_at, null);
});

test('unarchiveCollection returns null when no row matches', async () => {
  mock.method(db, 'query', async () => ({ rows: [] }));

  const result = await recordsRepository.unarchiveCollection('missing-id', 'company-1');

  assert.equal(result, null);
});

// TREEAPI-02: reorderCollections — lock-safe sibling renumber

test('reorderCollections locks siblings with blocking FOR UPDATE (no SKIP LOCKED), then renumbers via a single VALUES UPDATE', async () => {
  const calls: { sql: string; params?: unknown[] }[] = [];
  const fakeClient = {
    query: async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params });
      if (/SELECT id FROM data_collections/.test(sql)) {
        return { rows: [{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }] };
      }
      return { rows: [] };
    },
  } as unknown as PoolClient;

  await recordsRepository.reorderCollections(fakeClient, 'company-1', 'folder-1', ['c2', 'c1', 'c3']);

  assert.equal(calls.length, 2);
  assert.match(calls[0].sql, /FOR UPDATE/);
  assert.doesNotMatch(calls[0].sql, /SKIP LOCKED/);
  assert.match(calls[0].sql, /company_id = \$1/);
  assert.match(calls[0].sql, /folder_id IS NOT DISTINCT FROM \$2/);
  assert.match(calls[0].sql, /archived_at IS NULL/);
  assert.deepEqual(calls[0].params, ['company-1', 'folder-1']);

  assert.match(calls[1].sql, /FROM \(VALUES/);
  assert.deepEqual(calls[1].params, ['company-1', 'folder-1', 'c2', 'c1', 'c3']);
});

test('reorderCollections rejects with AppError 409 when orderedIds is missing a locked sibling id', async () => {
  const fakeClient = {
    query: async (sql: string) => {
      if (/SELECT id FROM data_collections/.test(sql)) return { rows: [{ id: 'c1' }, { id: 'c2' }] };
      return { rows: [] };
    },
  } as unknown as PoolClient;

  await assert.rejects(
    recordsRepository.reorderCollections(fakeClient, 'company-1', 'folder-1', ['c1']),
    (err: unknown) => err instanceof Error && (err as { status?: number }).status === 409,
  );
});

test('reorderCollections rejects with AppError 409 when orderedIds contains an id not in the locked set', async () => {
  const fakeClient = {
    query: async (sql: string) => {
      if (/SELECT id FROM data_collections/.test(sql)) return { rows: [{ id: 'c1' }, { id: 'c2' }] };
      return { rows: [] };
    },
  } as unknown as PoolClient;

  await assert.rejects(
    recordsRepository.reorderCollections(fakeClient, 'company-1', 'folder-1', ['c1', 'c2', 'c3']),
    (err: unknown) => err instanceof Error && (err as { status?: number }).status === 409,
  );
});

test('reorderCollections rejects with AppError 409 when the locked sibling set is empty but orderedIds is not', async () => {
  const fakeClient = {
    query: async (sql: string) => {
      if (/SELECT id FROM data_collections/.test(sql)) return { rows: [] };
      return { rows: [] };
    },
  } as unknown as PoolClient;

  await assert.rejects(
    recordsRepository.reorderCollections(fakeClient, 'company-1', 'folder-1', ['c1']),
    (err: unknown) => err instanceof Error && (err as { status?: number }).status === 409,
  );
});
