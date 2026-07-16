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
