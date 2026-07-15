import { test } from 'node:test';
import assert from 'node:assert/strict';
import { capabilityService, assertCapability } from './index';
import { buildRequestContext } from '../auth/request-context';

function makeContext(role: string, companyId = 'company-1') {
  process.env.DEPLOYMENT_MODE = 'cloud';
  return buildRequestContext({
    id: 'user-1',
    role,
    company_id: companyId,
    is_verified: true,
  }, 'req-1');
}

test('workspace and integration admin capabilities stay admin-only', () => {
  const member = makeContext('carrier');
  const admin = makeContext('admin');

  assert.equal(capabilityService.canWorkspaceAdmin(member).allowed, false);
  assert.equal(capabilityService.canWorkspaceAdmin(admin).allowed, true);
  assert.equal(capabilityService.canAdminIntegration(member).allowed, false);
  assert.equal(capabilityService.canAdminIntegration(admin).allowed, true);
});

test('record and program capabilities stay available to authenticated company members', () => {
  const member = makeContext('carrier');

  assert.equal(capabilityService.canReadRecord(member).allowed, true);
  assert.equal(capabilityService.canWriteRecord(member).allowed, true);
  assert.equal(capabilityService.canBuildProgram(member).allowed, true);
  assert.equal(capabilityService.canRunWorkflow(member).allowed, true);
});

test('assertCapability throws a 403 for missing capability', () => {
  const member = makeContext('carrier');

  assert.throws(
    () => assertCapability(member, 'integration.admin'),
    (error: unknown) => error instanceof Error && (error as { status?: number }).status === 403,
  );
});

test('resolveCapabilityMode returns an explicit demo fallback when the feature is unavailable', () => {
  const ctx = makeContext('admin');

  const result = capabilityService.resolveCapabilityMode(ctx, 'outlook.connect', {
    available: false,
    explicitFallbackLabel: 'Sample mailbox',
  });

  assert.equal(result.allowed, true);
  assert.equal(result.explicitFallback?.kind, 'demo');
  assert.equal(result.explicitFallback?.label, 'Sample mailbox');
});
