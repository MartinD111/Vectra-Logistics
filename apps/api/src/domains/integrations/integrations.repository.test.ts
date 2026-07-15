import { test, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../../core/db';
import { integrationsRepository } from './integrations.repository';

afterEach(() => {
  mock.restoreAll();
});

test('findCredentialRow scopes the lookup by company_id and provider', async () => {
  let capturedSql = '';
  let capturedParams: unknown[] = [];
  mock.method(db, 'query', async (sql: string, params: unknown[]) => {
    capturedSql = sql;
    capturedParams = params;
    return { rows: [] };
  });

  await integrationsRepository.findCredentialRow('company-1', 'samsara');

  assert.match(capturedSql, /company_id = \$1 AND provider = \$2/);
  assert.deepEqual(capturedParams, ['company-1', 'samsara']);
});
