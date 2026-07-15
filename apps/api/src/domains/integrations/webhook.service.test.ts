process.env.JWT_SECRET = 'phase-28-gate-secret';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { verifyTrustedPublicRequest } from './webhook.service';

test('verifyTrustedPublicRequest resolves gate company identity from a signed token', () => {
  const gateToken = jwt.sign(
    { company_id: 'company-1', gate: 'Gate A' },
    process.env.JWT_SECRET!,
  );

  const trust = verifyTrustedPublicRequest({
    edge: 'gate-anpr',
    gateToken,
  });

  assert.deepEqual(trust, { companyId: 'company-1', gate: 'Gate A' });
});

test('verifyTrustedPublicRequest rejects missing gate tokens', () => {
  assert.throws(
    () => verifyTrustedPublicRequest({ edge: 'gate-ocr' }),
    (error: unknown) => error instanceof Error && (error as { status?: number }).status === 401,
  );
});
