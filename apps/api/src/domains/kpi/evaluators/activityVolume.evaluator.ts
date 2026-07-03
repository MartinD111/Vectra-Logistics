import { kpiRepository } from '../kpi.repository';
import { KpiEvaluatorOutput, KpiRule } from '../kpi.types';
import { KpiEvaluator } from './types';

// Real, working evaluator — proves the framework computes genuine values, not
// just placeholders. Counts activity_events for the target user(s) in the
// period and compares against the rule's threshold.
class ActivityVolumeEvaluator implements KpiEvaluator {
  sourceType = 'activity_volume';

  async evaluate(rule: KpiRule, periodStart: Date, periodEnd: Date, companyId: string): Promise<KpiEvaluatorOutput[]> {
    const userIds = await this.resolveTargetUsers(rule, companyId);
    const results = await Promise.all(userIds.map(async (userId) => {
      const count = await kpiRepository.countActivityEvents(
        companyId, userId, periodStart.toISOString(), periodEnd.toISOString(),
      );
      return {
        user_id: userId,
        actual_value: count,
        target_value: rule.threshold,
        status: 'computed' as const,
        detail: { period_start: periodStart.toISOString(), period_end: periodEnd.toISOString() },
      };
    }));
    return results;
  }

  private async resolveTargetUsers(rule: KpiRule, companyId: string): Promise<string[]> {
    if (rule.target_user_id) return [rule.target_user_id];
    if (rule.target_project_id) {
      const assignments = await kpiRepository.listProjectAssignmentUsers(rule.target_project_id);
      return assignments.map((a) => a.user_id);
    }
    return [];
  }
}

export const activityVolumeEvaluator = new ActivityVolumeEvaluator();
