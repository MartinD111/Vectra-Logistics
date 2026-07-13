import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

// getAllowedOrigins() is read at module-load time inside server.ts, so the
// allowlist env var must be set before `./server` is imported.
process.env.CORS_ALLOWED_ORIGINS = 'https://allowed.example.com';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { app } = require('./server');

test('GET /health with allowed Origin -> access-control-allow-origin reflects it', async () => {
  const server = http.createServer(app);

  await new Promise<void>((resolve) => server.listen(0, resolve));

  try {
    const address = server.address();
    if (address === null || typeof address === 'string') {
      throw new Error('expected server to listen on a port');
    }
    const port = address.port;

    const headers: http.IncomingHttpHeaders = await new Promise((resolve, reject) => {
      http
        .get(
          `http://127.0.0.1:${port}/health`,
          { headers: { Origin: 'https://allowed.example.com' } },
          (res) => {
            res.on('data', () => {});
            res.on('end', () => resolve(res.headers));
          },
        )
        .on('error', reject);
    });

    assert.equal(headers['access-control-allow-origin'], 'https://allowed.example.com');
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
});

test('GET /health with disallowed Origin -> access-control-allow-origin absent', async () => {
  const server = http.createServer(app);

  await new Promise<void>((resolve) => server.listen(0, resolve));

  try {
    const address = server.address();
    if (address === null || typeof address === 'string') {
      throw new Error('expected server to listen on a port');
    }
    const port = address.port;

    const headers: http.IncomingHttpHeaders = await new Promise((resolve, reject) => {
      http
        .get(
          `http://127.0.0.1:${port}/health`,
          { headers: { Origin: 'https://evil.example.com' } },
          (res) => {
            res.on('data', () => {});
            res.on('end', () => resolve(res.headers));
          },
        )
        .on('error', reject);
    });

    assert.equal(headers['access-control-allow-origin'], undefined);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
});
