import { AppError } from '../../core/errors/AppError';
import { recordEvent } from '../../core/events/activityLog';
import { kpiRepository } from './kpi.repository';
import { KpiRule, KpiResult, KpiResultWithRule } from './kpi.types';
import { CreateKpiRuleSchema, UpdateKpiRuleSchema, RunEvaluationSchema } from './dto/kpiRule.dto';
import { getEvaluator } from './evaluators';

class KpiService {
  // ── Rules ────────────────────────────────────────────────────────────────────

  listRules(companyId: string): Promise<KpiRule[]> {
    return kpiRepository.listRules(companyId);
  }

  async getRule(id: string, companyId: string): Promise<KpiRule> {
    return this.assertOwnedRule(id, companyId);
  }

  async createRule(companyId: string, actorId: string | null, body: unknown): Promise<KpiRule> {
    const parsed = CreateKpiRuleSchema.safeParse(body);
    if (!parsed.success) throw new AppError(400, parsed.error.issues[0].message);
    if (parsed.data.target_project_id) await this.assertOwnedProject(parsed.data.target_project_id, companyId);
    if (parsed.data.target_user_id) await this.assertOwnedUser(parsed.data.target_user_id, companyId);

    const rule = await kpiRepository.createRule(companyId, actorId, parsed.data);
    await recordEvent({
      tenantId: companyId, actorId, verb: 'kpi.rule.created',
      objectType: 'kpi_rule', objectId: rule.id, projectId: rule.target_project_id,
      payload: { name: rule.name, source_type: rule.source_type },
    });
    return rule;
  }

  async updateRule(id: string, companyId: string, body: unknown): Promise<KpiRule> {
    await this.assertOwnedRule(id, companyId);
    const parsed = UpdateKpiRuleSchema.safeParse(body);
    if (!parsed.success) throw new AppError(400, parsed.error.issues[0].message);
    if (parsed.data.target_project_id) await this.assertOwnedProject(parsed.data.target_project_id, companyId);
    if (parsed.data.target_user_id) await this.assertOwnedUser(parsed.data.target_user_id, companyId);

    const updated = await kpiRepository.updateRule(id, parsed.data);
    if (!updated) throw new AppError(404, 'KPI rule not found');
    return updated;
  }

  async deleteRule(id: string, companyId: string): Promise<void> {
    await this.assertOwnedRule(id, companyId);
    await kpiRepository.deleteRule(id); // kpi_results.rule_id ON DELETE CASCADE
  }

  // ── Evaluation ───────────────────────────────────────────────────────────────

  async runEvaluation(companyId: string, body: unknown): Promise<KpiResult[]> {
    const parsed = RunEvaluationSchema.safeParse(body);
    if (!parsed.success) throw new AppError(400, parsed.error.issues[0].message);

    const periodStart = new Date(parsed.data.period_start);
    const periodEnd = new Date(parsed.data.period_end);
    if (periodEnd <= periodStart) throw new AppError(400, 'period_end must be after period_start');

    const rules = await kpiRepository.listActiveRules(companyId);
    const results: KpiResult[] = [];

    for (const rule of rules) {
      const evaluator = getEvaluator(rule.source_type);
      const outputs = await evaluator.evaluate(rule, periodStart, periodEnd, companyId);
      for (const output of outputs) {
        const result = await kpiRepository.upsertResult(companyId, rule.id, {
          user_id: output.user_id,
          period_start: periodStart.toISOString(),
          period_end: periodEnd.toISOString(),
          actual_value: output.actual_value,
          target_value: output.target_value,
          status: output.status,
          detail: output.detail,
        });
        results.push(result);
      }
    }

    return results;
  }

  listResults(
    companyId: string, filters: { ruleId?: string; userId?: string; projectId?: string },
  ): Promise<KpiResult[]> {
    return kpiRepository.listResults(companyId, filters);
  }

  getSummary(
    companyId: string, filters: { userId?: string; projectId?: string },
  ): Promise<KpiResultWithRule[]> {
    return kpiRepository.listResultsWithRuleInfo(companyId, filters);
  }

  // ── Internal ──────────────────────────────────────────────────────────────────

  private async assertOwnedRule(id: string, companyId: string): Promise<KpiRule> {
    const r = await kpiRepository.findRule(id);
    if (!r) throw new AppError(404, 'KPI rule not found');
    if (r.company_id !== companyId) throw new AppError(403, 'Forbidden');
    return r;
  }

  private async assertOwnedProject(projectId: string, companyId: string): Promise<void> {
    const projectCompanyId = await kpiRepository.findProjectCompany(projectId);
    if (!projectCompanyId) throw new AppError(404, 'Project not found');
    if (projectCompanyId !== companyId) throw new AppError(403, 'Forbidden');
  }

  private async assertOwnedUser(userId: string, companyId: string): Promise<void> {
    const userCompanyId = await kpiRepository.findUserCompany(userId);
    if (!userCompanyId) throw new AppError(404, 'User not found');
    if (userCompanyId !== companyId) throw new AppError(403, 'Forbidden');
  }
}

export const kpiService = new KpiService();
