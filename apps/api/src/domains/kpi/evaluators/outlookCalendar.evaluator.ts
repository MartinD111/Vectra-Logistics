import { kpiRepository } from '../kpi.repository';
import { KpiEvaluatorOutput, KpiRule } from '../kpi.types';
import { KpiEvaluator } from './types';

// Stub: real Outlook calendar sync (Calendars.Read scope, Graph event polling,
// event→project categorization) is a follow-up phase — apps/api/src/domains/outlook
// today only handles OAuth connect + Mail.Read/Send, no calendar data at all.
// This evaluator proves the rule/target wiring end-to-end (planned_pct from
// project_assignments) while clearly marking the actual value as unavailable.
class OutlookCalendarEvaluator implements KpiEvaluator {
  sourceType = 'outlook_calendar';

  async evaluate(rule: KpiRule): Promise<KpiEvaluatorOutput[]> {
    if (!rule.target_project_id) return [];
    const assignments = await kpiRepository.listProjectAssignmentUsers(rule.target_project_id);

    return assignments
      .filter((a) => !rule.target_user_id || a.user_id === rule.target_user_id)
      .map((a) => ({
        user_id: a.user_id,
        actual_value: null,
        target_value: Number(a.planned_pct),
        status: 'unavailable' as const,
        detail: { reason: 'Outlook calendar sync not yet implemented' },
      }));
  }
}

export const outlookCalendarEvaluator = new OutlookCalendarEvaluator();
