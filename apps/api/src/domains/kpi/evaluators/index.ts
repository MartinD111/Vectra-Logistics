import { kpiRepository } from '../kpi.repository';
import { KpiEvaluatorOutput, KpiRule } from '../kpi.types';
import { KpiEvaluator } from './types';
import { outlookCalendarEvaluator } from './outlookCalendar.evaluator';
import { activityVolumeEvaluator } from './activityVolume.evaluator';
import { creditRiskEvaluator } from './creditRisk.evaluator';

// Fallback for rule types with no evaluator implementation yet
// (task_completion, on_time_delivery, response_time, project_value — each
// needs entities/fields that don't exist in the schema yet).
class UnimplementedEvaluator implements KpiEvaluator {
  constructor(public sourceType: string) {}

  async evaluate(rule: KpiRule): Promise<KpiEvaluatorOutput[]> {
    const userIds = rule.target_user_id
      ? [rule.target_user_id]
      : rule.target_project_id
        ? (await kpiRepository.listProjectAssignmentUsers(rule.target_project_id)).map((a) => a.user_id)
        : [];
    return userIds.map((userId) => ({
      user_id: userId,
      client_id: null,
      actual_value: null,
      target_value: rule.threshold,
      status: 'unavailable' as const,
      detail: { reason: `No evaluator implemented yet for source_type '${this.sourceType}'` },
    }));
  }
}

const REGISTRY: Record<string, KpiEvaluator> = {
  [outlookCalendarEvaluator.sourceType]: outlookCalendarEvaluator,
  [activityVolumeEvaluator.sourceType]: activityVolumeEvaluator,
  [creditRiskEvaluator.sourceType]: creditRiskEvaluator,
};

export function getEvaluator(sourceType: string): KpiEvaluator {
  return REGISTRY[sourceType] ?? new UnimplementedEvaluator(sourceType);
}
