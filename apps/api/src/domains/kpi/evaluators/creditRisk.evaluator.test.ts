import { test, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { creditRiskEvaluator, computeCreditRiskDetail } from './creditRisk.evaluator';
import { kpiRepository } from '../kpi.repository';
import { KpiRule } from '../kpi.types';

function makeRule(overrides: Partial<KpiRule> = {}): KpiRule {
  return {
    id: 'rule-1', company_id: 'company-1', name: 'Credit risk', description: null,
    source_type: 'credit_risk', target_project_id: null, target_user_id: null, target_client_id: null,
    condition: {}, weight: 1, threshold: null, is_active: true, created_by: null,
    created_at: new Date(), updated_at: new Date(),
    ...overrides,
  };
}

afterEach(() => {
  mock.restoreAll();
});

test('over-limit client computes over_limit true regardless of overdue invoices', () => {
  const detail = computeCreditRiskDetail({ credit_limit: 10000, outstanding_balance: 12000 }, 0);
  assert.equal(detail.over_limit, true);
  assert.equal(detail.overdue_invoice_count, 0);
  assert.equal(detail.at_risk, true);
});

test('under-limit client with an overdue invoice is at_risk via payment history alone', () => {
  const detail = computeCreditRiskDetail({ credit_limit: 10000, outstanding_balance: 4000 }, 1);
  assert.equal(detail.over_limit, false);
  assert.equal(detail.has_overdue_invoices, true);
  assert.equal(detail.at_risk, true);
});

test('under-limit client with no overdue invoices is not at_risk', () => {
  const detail = computeCreditRiskDetail({ credit_limit: 10000, outstanding_balance: 4000 }, 0);
  assert.equal(detail.at_risk, false);
});

test('utilization_pct is outstanding/limit * 100, and credit_limit=0 falls back to 100', () => {
  const withLimit = computeCreditRiskDetail({ credit_limit: 10000, outstanding_balance: 2500 }, 0);
  assert.equal(withLimit.utilization_pct, 25);

  const zeroLimit = computeCreditRiskDetail({ credit_limit: 0, outstanding_balance: 500 }, 0);
  assert.equal(zeroLimit.utilization_pct, 100);
});

test('evaluate() with target_client_id only evaluates that one client', async () => {
  mock.method(kpiRepository, 'findClientForRisk', async (clientId: string) => ({
    id: clientId, credit_limit: 10000, outstanding_balance: 3000,
  }));
  mock.method(kpiRepository, 'countOverdueInvoices', async () => 0);
  const listClientsMock = mock.method(kpiRepository, 'listClientsForCompany', async () => []);

  const rule = makeRule({ target_client_id: 'client-42' });
  const outputs = await creditRiskEvaluator.evaluate(rule, new Date(), new Date(), 'company-1');

  assert.equal(outputs.length, 1);
  assert.equal(outputs[0].client_id, 'client-42');
  assert.equal(outputs[0].user_id, null);
  assert.equal(listClientsMock.mock.calls.length, 0);
});

test('evaluate() with no target_client_id evaluates every client in the company', async () => {
  mock.method(kpiRepository, 'listClientsForCompany', async () => [
    { id: 'c1', credit_limit: 10000, outstanding_balance: 3000 },
    { id: 'c2', credit_limit: 5000, outstanding_balance: 6000 },
  ]);
  mock.method(kpiRepository, 'countOverdueInvoices', async () => 0);
  const findClientMock = mock.method(kpiRepository, 'findClientForRisk', async () => null);

  const rule = makeRule({ target_client_id: null });
  const outputs = await creditRiskEvaluator.evaluate(rule, new Date(), new Date(), 'company-1');

  assert.equal(outputs.length, 2);
  assert.deepEqual(new Set(outputs.map((o) => o.client_id)), new Set(['c1', 'c2']));
  assert.equal(findClientMock.mock.calls.length, 0);
});
