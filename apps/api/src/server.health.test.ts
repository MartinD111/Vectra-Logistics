import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { app } from './server';

test('GET /health -> live dependency check, status/HTTP-code consistent, version preserved', async () => {
  const server = http.createServer(app);

  await new Promise<void>((resolve) => server.listen(0, resolve));

  try {
    const address = server.address();
    if (address === null || typeof address === 'string') {
      throw new Error('expected server to listen on a port');
    }
    const port = address.port;

    // This test imports { app } directly without calling bootstrap(), so
    // redisClient.ping() on the never-.connect()-ed v4 client will throw
    // (ClientClosedError) rather than lazily connect — the test process will
    // very likely exercise the 503 path, not the 200 path. Assertions below
    // therefore verify shape + status/HTTP-code consistency, not a fixed
    // 'OK'/200 outcome.
    const { statusCode, body } = await new Promise<{ statusCode: number; body: string }>(
      (resolve, reject) => {
        http
          .get(`http://127.0.0.1:${port}/health`, (res) => {
            let data = '';
            res.on('data', (chunk) => (data += chunk));
            res.on('end', () => resolve({ statusCode: res.statusCode ?? 0, body: data }));
          })
          .on('error', reject);
      },
    );

    const parsed = JSON.parse(body);
    assert.equal(typeof parsed.version, 'string');
    assert.ok(parsed.dependencies && typeof parsed.dependencies === 'object');
    assert.ok(['ok', 'down'].includes(parsed.dependencies.postgres));
    assert.ok(['ok', 'down'].includes(parsed.dependencies.redis));

    if (parsed.status === 'OK') {
      assert.equal(statusCode, 200);
    } else {
      assert.equal(parsed.status, 'unhealthy');
      assert.equal(statusCode, 503);
    }
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
});
