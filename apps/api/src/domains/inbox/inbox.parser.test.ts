// DEPLOYMENT_MODE must be set before importing anything that touches
// secrets.ts's module-level cache — getDeploymentMode() caches after first
// read, and hasUsableProvider (mocked here directly, but still transitively
// imported via ai.service.ts) reads it.
process.env.DEPLOYMENT_MODE = 'on-prem';

import { test, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { inboxParser } from './inbox.parser';
import { aiService } from '../ai/ai.service';

afterEach(() => {
  mock.restoreAll();
});

const EMAIL = { subject: 'Load ready', body: 'We have a load from Koper to Munich, 22 tonnes, ref BRK-4471.' };

test('extract(): hasCloudProvider false, hasUsableProvider true, complete resolves -> real extraction, demo:false', async () => {
  mock.method(aiService, 'hasCloudProvider', async () => false);
  mock.method(aiService, 'hasUsableProvider', async () => true);
  const completeMock = mock.method(aiService, 'complete', async () => ({
    text: JSON.stringify({ origin: 'Koper', destination: 'Munich', cargo_type: 'steel', weight_kg: 22000, pickup_date: null, delivery_date: null, wagon_number: null, reference: 'BRK-4471', confidence: 0.9 }),
    provider: 'local',
    model: 'gemma3',
  }));

  const result = await inboxParser.extract('company-1', EMAIL);

  assert.equal(result.demo, false);
  assert.equal(result.extraction.origin, 'Koper');
  assert.equal(result.extraction.reference, 'BRK-4471');
  assert.equal(completeMock.mock.calls.length, 1);
});

test('extract(): hasCloudProvider false, hasUsableProvider false -> demoExtract, demo:true, complete never called', async () => {
  mock.method(aiService, 'hasCloudProvider', async () => false);
  mock.method(aiService, 'hasUsableProvider', async () => false);
  const completeMock = mock.method(aiService, 'complete', async () => {
    throw new Error('should not be called');
  });

  const result = await inboxParser.extract('company-1', EMAIL);

  assert.equal(result.demo, true);
  assert.equal(completeMock.mock.calls.length, 0);
});

test('extract(): hasUsableProvider true but complete() rejects -> degrades to demoExtract, demo:false, does not throw', async () => {
  mock.method(aiService, 'hasCloudProvider', async () => false);
  mock.method(aiService, 'hasUsableProvider', async () => true);
  mock.method(aiService, 'complete', async () => {
    throw new Error('timeout');
  });

  const result = await inboxParser.extract('company-1', EMAIL);

  assert.equal(result.demo, false);
  assert.equal(result.extraction.origin, 'Koper');
});
