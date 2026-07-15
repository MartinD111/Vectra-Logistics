import { test, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../../core/db';
import { podRepository } from './pod.repository';

afterEach(() => {
  mock.restoreAll();
});

test('findById scopes POD requests by company_id', async () => {
  let capturedSql = '';
  let capturedParams: unknown[] = [];
  mock.method(db, 'query', async (sql: string, params: unknown[]) => {
    capturedSql = sql;
    capturedParams = params;
    return { rows: [] };
  });

  await podRepository.findById('pod-1', 'company-1');

  assert.match(capturedSql, /id = \$1 AND company_id = \$2/);
  assert.deepEqual(capturedParams, ['pod-1', 'company-1']);
});
