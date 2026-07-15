import { test, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { crmService } from './crm.service';
import { crmRepository } from './crm.repository';
import { projectsRepository } from '../projects/projects.repository';

afterEach(() => {
  mock.restoreAll();
});

test('upsertClientProjectLink fails when the target project is outside the company scope', async () => {
  mock.method(crmRepository, 'findClient', async () => ({
    id: 'client-1',
    company_id: 'company-1',
    name: 'Client',
    country: 'SI',
    vat_id: null,
    email: null,
    credit_limit: 1000,
    default_rate_eur: null,
    notes: null,
    address: null,
    responsible_employee_id: null,
    created_at: new Date(),
    updated_at: new Date(),
  }) as any);
  const findProjectMock = mock.method(projectsRepository, 'findProjectForCompany', async () => null);

  await assert.rejects(
    crmService.upsertClientProjectLink('client-1', 'company-1', { project_id: '11111111-1111-4111-8111-111111111111' }),
    (error: unknown) => error instanceof Error && (error as { status?: number }).status === 404,
  );
  assert.deepEqual(findProjectMock.mock.calls[0].arguments, ['11111111-1111-4111-8111-111111111111', 'company-1']);
});
