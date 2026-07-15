import { test } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { authenticateToken } from './middleware';

const JWT_SECRET = 'phase-28-test-secret';

function makeResponse() {
  return {
    statusCode: 200,
    body: null as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
}

test('authenticateToken attaches typed request context with deployment metadata and request id', async () => {
  process.env.JWT_SECRET = JWT_SECRET;
  process.env.DEPLOYMENT_MODE = 'cloud';

  const token = jwt.sign(
    { id: 'user-1', role: 'admin', company_id: 'company-1', is_verified: true },
    JWT_SECRET,
  );
  const req = {
    headers: {
      authorization: `Bearer ${token}`,
      'x-request-id': 'req-123',
    },
  } as any;
  const res = makeResponse();

  await new Promise<void>((resolve) => authenticateToken(req, res as any, (() => resolve()) as any));

  assert.equal(req.user.id, 'user-1');
  assert.equal(req.context.companyId, 'company-1');
  assert.equal(req.context.workspaceId, 'company-1');
  assert.equal(req.context.requestId, 'req-123');
  assert.equal(req.context.deploymentMode, 'cloud');
  assert.equal(req.context.deploymentCapabilities.allowsSelfSignup, true);
});

test('authenticateToken preserves 401 when the bearer token is missing', async () => {
  const req = { headers: {} } as any;
  const res = makeResponse();

  authenticateToken(req, res as any, () => {
    throw new Error('next should not be called');
  });

  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.body, { error: 'Access token required' });
});
