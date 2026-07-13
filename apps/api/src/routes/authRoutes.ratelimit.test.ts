import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { app } from '../server';

test('POST /api/auth/login -> 429 after 20 requests within the rate-limit window', async () => {
  const server = http.createServer(app);

  await new Promise<void>((resolve) => server.listen(0, resolve));

  try {
    const address = server.address();
    if (address === null || typeof address === 'string') {
      throw new Error('expected server to listen on a port');
    }
    const port = address.port;

    const sendLoginRequest = (): Promise<{ status: number; body: string }> =>
      new Promise((resolve, reject) => {
        const payload = JSON.stringify({
          email: 'ratelimit-test@example.com',
          password: 'wrong-password',
        });

        const req = http.request(
          {
            hostname: '127.0.0.1',
            port,
            path: '/api/auth/login',
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(payload),
            },
          },
          (res) => {
            let data = '';
            res.on('data', (chunk) => (data += chunk));
            res.on('end', () => resolve({ status: res.statusCode ?? 0, body: data }));
          }
        );

        req.on('error', reject);
        req.write(payload);
        req.end();
      });

    let lastResponse: { status: number; body: string } | null = null;

    for (let i = 1; i <= 21; i++) {
      const response = await sendLoginRequest();
      if (i <= 20) {
        assert.notEqual(
          response.status,
          429,
          `request ${i} of 20 should not be rate-limited, got ${response.status}`
        );
      } else {
        lastResponse = response;
      }
    }

    assert.ok(lastResponse, 'expected a 21st response to have been captured');
    assert.equal(lastResponse!.status, 429);
    assert.equal(JSON.parse(lastResponse!.body).error, 'Too many requests. Please try again later.');
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
});
