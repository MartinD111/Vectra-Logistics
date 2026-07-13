import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { app } from './server';

test('GET /health -> 200 OK with status + version fields', async () => {
  const server = http.createServer(app);

  await new Promise<void>((resolve) => server.listen(0, resolve));

  try {
    const address = server.address();
    if (address === null || typeof address === 'string') {
      throw new Error('expected server to listen on a port');
    }
    const port = address.port;

    const body: string = await new Promise((resolve, reject) => {
      http
        .get(`http://127.0.0.1:${port}/health`, (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => resolve(data));
        })
        .on('error', reject);
    });

    const parsed = JSON.parse(body);
    assert.equal(parsed.status, 'OK');
    assert.equal(typeof parsed.version, 'string');
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
});
