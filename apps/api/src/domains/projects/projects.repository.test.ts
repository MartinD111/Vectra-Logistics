import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { PoolClient } from 'pg';
import { projectsRepository } from './projects.repository';

// TREEAPI-02: reorderProjects — lock-safe sibling renumber

test('reorderProjects locks siblings with blocking FOR UPDATE (no SKIP LOCKED), then renumbers via a single VALUES UPDATE', async () => {
  const calls: { sql: string; params?: unknown[] }[] = [];
  const fakeClient = {
    query: async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params });
      if (/SELECT id FROM projects/.test(sql)) {
        return { rows: [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }] };
      }
      return { rows: [] };
    },
  } as unknown as PoolClient;

  await projectsRepository.reorderProjects(fakeClient, 'company-1', 'folder-1', ['p2', 'p1', 'p3']);

  assert.equal(calls.length, 2);
  assert.match(calls[0].sql, /FOR UPDATE/);
  assert.doesNotMatch(calls[0].sql, /SKIP LOCKED/);
  assert.match(calls[0].sql, /company_id = \$1/);
  assert.match(calls[0].sql, /folder_id IS NOT DISTINCT FROM \$2/);
  assert.match(calls[0].sql, /archived_at IS NULL/);
  assert.deepEqual(calls[0].params, ['company-1', 'folder-1']);

  assert.match(calls[1].sql, /FROM \(VALUES/);
  assert.equal(calls[1].params?.length, 2 + 3);
  assert.deepEqual(calls[1].params, ['company-1', 'folder-1', 'p2', 'p1', 'p3']);
});

test('reorderProjects rejects with AppError 409 when orderedIds is missing a locked sibling id', async () => {
  const fakeClient = {
    query: async (sql: string) => {
      if (/SELECT id FROM projects/.test(sql)) {
        return { rows: [{ id: 'p1' }, { id: 'p2' }] };
      }
      return { rows: [] };
    },
  } as unknown as PoolClient;

  await assert.rejects(
    projectsRepository.reorderProjects(fakeClient, 'company-1', 'folder-1', ['p1']),
    (err: unknown) => err instanceof Error && (err as { status?: number }).status === 409,
  );
});

test('reorderProjects rejects with AppError 409 when orderedIds contains an id not in the locked set', async () => {
  const fakeClient = {
    query: async (sql: string) => {
      if (/SELECT id FROM projects/.test(sql)) {
        return { rows: [{ id: 'p1' }, { id: 'p2' }] };
      }
      return { rows: [] };
    },
  } as unknown as PoolClient;

  await assert.rejects(
    projectsRepository.reorderProjects(fakeClient, 'company-1', 'folder-1', ['p1', 'p2', 'p3']),
    (err: unknown) => err instanceof Error && (err as { status?: number }).status === 409,
  );
});

test('reorderProjects rejects with AppError 409 when the locked sibling set is empty but orderedIds is not', async () => {
  const fakeClient = {
    query: async (sql: string) => {
      if (/SELECT id FROM projects/.test(sql)) {
        return { rows: [] };
      }
      return { rows: [] };
    },
  } as unknown as PoolClient;

  await assert.rejects(
    projectsRepository.reorderProjects(fakeClient, 'company-1', 'folder-1', ['p1']),
    (err: unknown) => err instanceof Error && (err as { status?: number }).status === 409,
  );
});

// TREEAPI-02: reorderPrograms — same shape, scoped by folder_id AND project_id

test('reorderPrograms locks siblings scoped by folder_id and project_id, then renumbers', async () => {
  const calls: { sql: string; params?: unknown[] }[] = [];
  const fakeClient = {
    query: async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params });
      if (/SELECT id FROM programs/.test(sql)) {
        return { rows: [{ id: 'prog1' }, { id: 'prog2' }] };
      }
      return { rows: [] };
    },
  } as unknown as PoolClient;

  await projectsRepository.reorderPrograms(
    fakeClient, 'company-1', { folderId: null, projectId: 'project-1' }, ['prog2', 'prog1'],
  );

  assert.match(calls[0].sql, /FOR UPDATE/);
  assert.doesNotMatch(calls[0].sql, /SKIP LOCKED/);
  assert.match(calls[0].sql, /folder_id IS NOT DISTINCT FROM \$2/);
  assert.match(calls[0].sql, /project_id IS NOT DISTINCT FROM \$3/);
  assert.deepEqual(calls[0].params, ['company-1', null, 'project-1']);

  assert.match(calls[1].sql, /FROM \(VALUES/);
  assert.equal(calls[1].params?.length, 3 + 2);
  assert.deepEqual(calls[1].params, ['company-1', null, 'project-1', 'prog2', 'prog1']);
});

test('reorderPrograms rejects with AppError 409 on a stale sibling set', async () => {
  const fakeClient = {
    query: async (sql: string) => {
      if (/SELECT id FROM programs/.test(sql)) {
        return { rows: [{ id: 'prog1' }] };
      }
      return { rows: [] };
    },
  } as unknown as PoolClient;

  await assert.rejects(
    projectsRepository.reorderPrograms(
      fakeClient, 'company-1', { folderId: 'folder-1', projectId: null }, ['prog1', 'prog2'],
    ),
    (err: unknown) => err instanceof Error && (err as { status?: number }).status === 409,
  );
});
