// DEPLOYMENT_MODE must be set before importing anything that touches
// secrets.ts's module-level cache — getDeploymentMode() caches after first
// read. node --test runs each matching file in its own process, so this is
// safe alongside ai.service.cloud-unchanged.test.ts using a different value.
process.env.DEPLOYMENT_MODE = 'on-prem';

import { test, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';
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

test('hasUsableProvider: true when on-prem + provider=local + local_endpoint set', async () => {
  mock.method(aiRepository, 'findByCompany', async () => makeRow());

  const result = await aiService.hasUsableProvider('company-1');

  assert.equal(result, true);
});

test('hasUsableProvider: false when local_endpoint is null', async () => {
  mock.method(aiRepository, 'findByCompany', async () => makeRow({ local_endpoint: null }));

  const result = await aiService.hasUsableProvider('company-1');

  assert.equal(result, false);
});

test('hasUsableProvider: false when provider is not local', async () => {
  mock.method(aiRepository, 'findByCompany', async () => makeRow({ provider: 'openai', api_key_enc: 'enc' }));

  const result = await aiService.hasUsableProvider('company-1');

  assert.equal(result, false);
});

test('complete(): on-prem + local + local_endpoint dispatches to completeLocal via axios', async () => {
  mock.method(aiRepository, 'findByCompany', async () => makeRow({ local_model: 'gemma3:custom' }));
  const postMock = mock.method(axios, 'post', async () => ({
    data: { choices: [{ message: { content: '{"ok":true}' } }] },
  }));

  const result = await aiService.complete('company-1', { prompt: 'hello' });

  assert.equal(postMock.mock.calls.length, 1);
  const [url, , options] = postMock.mock.calls[0].arguments as [string, unknown, { timeout?: number }];
  assert.ok(url.endsWith('/v1/chat/completions'));
  assert.equal(options.timeout, 180000);
  assert.deepEqual(result, { text: '{"ok":true}', provider: 'local', model: 'gemma3:custom' });
});

test('complete(): local provider with no local_endpoint still throws AppError(400) unchanged', async () => {
  mock.method(aiRepository, 'findByCompany', async () => makeRow({ local_endpoint: null }));

  await assert.rejects(
    () => aiService.complete('company-1', { prompt: 'hello' }),
    (err: any) => {
      assert.equal(err.status, 400);
      assert.equal(err.message, 'Local providers are called directly from the browser, not via the server proxy.');
      return true;
    },
  );
});
