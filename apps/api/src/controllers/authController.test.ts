// Set DEPLOYMENT_MODE before importing anything that touches secrets.ts's
// module-level cache — getDeploymentMode() caches after first read, so if
// node --test ever runs files in the same process this must run first.
process.env.DEPLOYMENT_MODE = 'on-prem';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { signup } from './authController';

// signup() does real db.connect()/client.query() calls once past the gate,
// so we only test the gate's early-return behavior in isolation here — no
// mocking library is installed in this repo, so mock Request/Response with
// plain closures/counters.

function makeMockRes() {
  const calls: { status?: number; json?: unknown } = {};
  const res: any = {
    status(code: number) {
      calls.status = code;
      return res;
    },
    json(body: unknown) {
      calls.json = body;
      return res;
    },
  };
  return { res, calls };
}

test('signup() returns 403 immediately when DEPLOYMENT_MODE=on-prem, before any DB I/O', async () => {
  process.env.DEPLOYMENT_MODE = 'on-prem';
  const mockReq = { body: {} } as any;
  const { res, calls } = makeMockRes();

  await signup(mockReq, res);

  assert.equal(calls.status, 403);
  assert.equal(typeof (calls.json as any)?.error, 'string');
});
