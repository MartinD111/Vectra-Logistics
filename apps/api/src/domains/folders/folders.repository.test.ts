import { test, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../../core/db';
import { foldersRepository } from './folders.repository';

afterEach(() => {
  mock.restoreAll();
});

test('createFolder inserts a row with ancestor_ids = [] when given an empty ancestorIds array', async () => {
  let capturedSql = '';
  let capturedParams: unknown[] = [];
  mock.method(db, 'query', async (sql: string, params: unknown[]) => {
    capturedSql = sql;
    capturedParams = params;
    return {
      rows: [{
        id: 'folder-1', company_id: 'company-1', parent_id: null, name: 'Folder',
        icon: null, color: null, sort_order: 0, created_by: 'user-1',
        created_at: new Date(), updated_at: new Date(), ancestor_ids: [], archived_at: null,
      }],
    };
  });

  await foldersRepository.createFolder('company-1', 'user-1', { name: 'Folder' }, []);

  assert.match(capturedSql, /INSERT INTO folders/);
  assert.match(capturedSql, /ancestor_ids/);
  assert.deepEqual(capturedParams[5], []);
});

test('createFolder passes the exact ancestorIds array as a query param', async () => {
  let capturedParams: unknown[] = [];
  mock.method(db, 'query', async (sql: string, params: unknown[]) => {
    capturedParams = params;
    return {
      rows: [{
        id: 'folder-2', company_id: 'company-1', parent_id: 'a', name: 'Child',
        icon: null, color: null, sort_order: 0, created_by: 'user-1',
        created_at: new Date(), updated_at: new Date(), ancestor_ids: ['a', 'p'], archived_at: null,
      }],
    };
  });

  await foldersRepository.createFolder('company-1', 'user-1', { name: 'Child', parent_id: 'p' }, ['a', 'p']);

  assert.deepEqual(capturedParams[5], ['a', 'p']);
});

test('descendantFolderIds issues one query using ancestor_ids @> and returns the resolved id list', async () => {
  let callCount = 0;
  let capturedSql = '';
  let capturedParams: unknown[] = [];
  mock.method(db, 'query', async (sql: string, params: unknown[]) => {
    callCount += 1;
    capturedSql = sql;
    capturedParams = params;
    return { rows: [{ id: 'folder-1' }, { id: 'folder-2' }] };
  });

  const ids = await foldersRepository.descendantFolderIds('company-1', 'folder-1');

  assert.equal(callCount, 1);
  assert.match(capturedSql, /ancestor_ids @>/);
  assert.deepEqual(capturedParams, ['company-1', 'folder-1']);
  assert.deepEqual(ids, ['folder-1', 'folder-2']);
});

test('moveFolder updates parent_id and ancestor_ids on the moved row in one query', async () => {
  let callCount = 0;
  let capturedSql = '';
  let capturedParams: unknown[] = [];
  mock.method(db, 'query', async (sql: string, params: unknown[]) => {
    callCount += 1;
    capturedSql = sql;
    capturedParams = params;
    return {
      rows: [{
        id: 'folder-1', company_id: 'company-1', parent_id: 'new-parent', name: 'Folder',
        icon: null, color: null, sort_order: 0, created_by: 'user-1',
        created_at: new Date(), updated_at: new Date(), ancestor_ids: ['new-parent'], archived_at: null,
      }],
    };
  });

  const result = await foldersRepository.moveFolder('folder-1', 'new-parent', ['new-parent']);

  assert.equal(callCount, 1);
  assert.match(capturedSql, /UPDATE folders SET parent_id = \$2, ancestor_ids = \$3/);
  assert.deepEqual(capturedParams, ['folder-1', 'new-parent', ['new-parent']]);
  assert.equal(result?.parent_id, 'new-parent');
});

test('patchDescendantAncestors rewrites the ancestor_ids prefix for every descendant of folderId in one query', async () => {
  let callCount = 0;
  let capturedSql = '';
  let capturedParams: unknown[] = [];
  const fakeClient = {
    query: async (sql: string, params: unknown[]) => {
      callCount += 1;
      capturedSql = sql;
      capturedParams = params;
      return { rows: [] };
    },
  };

  await foldersRepository.patchDescendantAncestors(
    fakeClient as never, 'folder-1', ['root', 'folder-1'], ['root', 'new-parent', 'folder-1'], 'company-1',
  );

  assert.equal(callCount, 1);
  assert.match(capturedSql, /ancestor_ids @> ARRAY\[\$4\]::uuid\[\]/);
  assert.deepEqual(capturedParams, ['company-1', 'folder-1', ['root', 'new-parent', 'folder-1'], 'folder-1']);
});

test('archiveFolderSubtree only returns/archives rows with archived_at IS NULL', async () => {
  let capturedSql = '';
  let capturedParams: unknown[] = [];
  const fakeClient = {
    query: async (sql: string, params: unknown[]) => {
      capturedSql = sql;
      capturedParams = params;
      return { rows: [{ id: 'folder-1', archived_at: new Date() }] };
    },
  };

  const rows = await foldersRepository.archiveFolderSubtree(fakeClient as never, ['folder-1', 'folder-2'], 'company-1');

  assert.match(capturedSql, /archived_at IS NULL/);
  assert.deepEqual(capturedParams, ['company-1', ['folder-1', 'folder-2']]);
  assert.equal(rows.length, 1);
});

test('unarchiveFolder clears archived_at and returns null if the folder does not belong to that company', async () => {
  mock.method(db, 'query', async () => ({ rows: [] }));

  const result = await foldersRepository.unarchiveFolder('folder-1', 'other-company');

  assert.equal(result, null);
});
