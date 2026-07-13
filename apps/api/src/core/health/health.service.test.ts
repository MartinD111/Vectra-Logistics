import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkDependencyHealth } from './health.service';

test('both queryPostgres and pingRedis resolve -> { postgres: ok, redis: ok }', async () => {
  const result = await checkDependencyHealth({
    queryPostgres: async () => ({ rows: [] }),
    pingRedis: async () => 'PONG',
  });
  assert.deepEqual(result, { postgres: 'ok', redis: 'ok' });
});

test('queryPostgres rejects, pingRedis resolves -> { postgres: down, redis: ok }', async () => {
  const result = await checkDependencyHealth({
    queryPostgres: async () => {
      throw new Error('connection refused');
    },
    pingRedis: async () => 'PONG',
  });
  assert.deepEqual(result, { postgres: 'down', redis: 'ok' });
});

test('queryPostgres resolves, pingRedis rejects -> { postgres: ok, redis: down }', async () => {
  const result = await checkDependencyHealth({
    queryPostgres: async () => ({ rows: [] }),
    pingRedis: async () => {
      throw new Error('client closed');
    },
  });
  assert.deepEqual(result, { postgres: 'ok', redis: 'down' });
});

test('both queryPostgres and pingRedis reject -> { postgres: down, redis: down }', async () => {
  const result = await checkDependencyHealth({
    queryPostgres: async () => {
      throw new Error('connection refused');
    },
    pingRedis: async () => {
      throw new Error('client closed');
    },
  });
  assert.deepEqual(result, { postgres: 'down', redis: 'down' });
});
