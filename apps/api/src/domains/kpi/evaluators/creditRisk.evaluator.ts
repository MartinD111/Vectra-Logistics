import { kpiRepository } from '../kpi.repository';
import { KpiEvaluatorOutput, KpiRule } from '../kpi.types';
import { KpiEvaluator } from './types';

export interface CreditRiskDetail {
  utilization_pct: number;
  over_limit: boolean;
  has_overdue_invoices: boolean;
  at_risk: boolean;
  overdue_invoice_count: number;
}

/**
 * Pure risk computation shared by the evaluator and crmService.getClientRisk()
 * so both surfaces agree on what "at risk" means, with zero duplicated logic.
 * over_limit uses the same `>=` comparison as CreditBar (CrmClientsBlock.tsx)
 * and assertCreditOk (invoicing.service.ts) so all three never disagree.
 */
export function computeCreditRiskDetail(
  client: { credit_limit: number; outstanding_balance: number },
  overdueInvoiceCount: number,
): CreditRiskDetail {
  const utilization_pct = client.credit_limit > 0
    ? (client.outstanding_balance / client.credit_limit) * 100
    : 100;
  const over_limit = client.outstanding_balance >= client.credit_limit;
  const has_overdue_invoices = overdueInvoiceCount > 0;
  return {
    utilization_pct,
    over_limit,
    has_overdue_invoices,
    at_risk: over_limit || has_overdue_invoices,
    overdue_invoice_count: overdueInvoiceCount,
  };
}

// Client-subject evaluator (RSK-01): computes each client's credit-risk status
// from utilization (credit_limit vs outstanding_balance) and payment history
// (overdue invoices). Targets a single client via rule.target_client_id, or
// every client in the company when target_client_id is null.
class CreditRiskEvaluator implements KpiEvaluator {
  sourceType = 'credit_risk';

  async evaluate(rule: KpiRule, _periodStart: Date, _periodEnd: Date, companyId: string): Promise<KpiEvaluatorOutput[]> {
    const clients = await this.resolveTargetClients(rule, companyId);

    return Promise.all(
      clients.map(async (client): Promise<KpiEvaluatorOutput> => {
        const overdueCount = await kpiRepository.countOverdueInvoices(companyId, client.id);
        const detail = computeCreditRiskDetail(client, overdueCount);
        return {
          user_id: null,
          client_id: client.id,
          actual_value: detail.utilization_pct,
          target_value: rule.threshold,
          status: 'computed',
          detail: { ...detail },
        };
      }),
    );
  }

  private async resolveTargetClients(
    rule: KpiRule, companyId: string,
  ): Promise<{ id: string; credit_limit: number; outstanding_balance: number }[]> {
    if (rule.target_client_id) {
      const client = await kpiRepository.findClientForRisk(rule.target_client_id, companyId);
      return client ? [client] : [];
    }
    return kpiRepository.listClientsForCompany(companyId);
  }
}

export const creditRiskEvaluator = new CreditRiskEvaluator();
