import { KpiEvaluatorOutput, KpiRule } from '../kpi.types';

export interface KpiEvaluator {
  sourceType: string;
  evaluate(rule: KpiRule, periodStart: Date, periodEnd: Date, companyId: string): Promise<KpiEvaluatorOutput[]>;
}
