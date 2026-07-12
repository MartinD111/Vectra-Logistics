// DEPLOYMENT_MODE must be set before importing anything that touches
// secrets.ts's module-level cache — getDeploymentMode() caches after first
// read. node --test runs each matching file in its own process, so this is
// safe alongside ai.service.local-dispatch.test.ts using a different value.
process.env.DEPLOYMENT_MODE = 'cloud';

import { test, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { aiService } from './ai.service';
import { aiRepository } from './ai.repository';
import { AiConfigRow } from './ai.types';

afterEach(() => {
  mock.restoreAll();
});

function makeRow(overrides: Partial<AiConfigRow> = {}): AiConfigRow {
  return {
    company_id: 'company-1',
    provider: 'local',
    model: null,
    api_key_enc: null,
    local_endpoint: 'http://host:11434',
    local_model: null,
    updated_at: new Date(),
    ...overrides,
  };
}

test('hasUsableProvider: always false on cloud, even provider=local with local_endpoint set', async () => {
  mock.method(aiRepository, 'findByCompany', async () => makeRow());

  const result = await aiService.hasUsableProvider('company-1');

  assert.equal(result, false);
});

test('complete(): local provider with local_endpoint set still hard-throws on cloud — unchanged pre-phase behavior', async () => {
  mock.method(aiRepository, 'findByCompany', async () => makeRow());

  await assert.rejects(
    () => aiService.complete('company-1', { prompt: 'hello' }),
    (err: any) => {
      assert.equal(err.status, 400);
      assert.equal(err.message, 'Local providers are called directly from the browser, not via the server proxy.');
      return true;
    },
  );
});
