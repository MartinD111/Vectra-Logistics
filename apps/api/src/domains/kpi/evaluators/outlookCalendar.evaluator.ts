import { kpiRepository } from '../kpi.repository';
import { KpiEvaluatorOutput, KpiRule } from '../kpi.types';
import { KpiEvaluator } from './types';
import { calendarRepository } from '../../outlook/calendar.repository';

const WORKDAY_HOURS = 8;

/** Count weekdays (Mon–Fri) in [start, end) — the workday denominator for a period. */
function workdaysInPeriod(start: Date, end: Date): number {
  let count = 0;
  const d = new Date(start);
  d.setUTCHours(0, 0, 0, 0);
  while (d < end) {
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) count++;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return count;
}

// Compares planned_pct (from project_assignments) against actual time spent —
// summed from calendar_events attended by the user, categorized to the rule's
// project via Outlook event categories (see outlook.service.syncCalendar).
// Falls back to 'unavailable' when the user's email has no synced meeting
// data for the period (no connected calendar, or nothing synced yet).
class OutlookCalendarEvaluator implements KpiEvaluator {
  sourceType = 'outlook_calendar';

  async evaluate(rule: KpiRule, periodStart: Date, periodEnd: Date, companyId: string): Promise<KpiEvaluatorOutput[]> {
    if (!rule.target_project_id) return [];
    const assignments = await kpiRepository.listProjectAssignmentUsers(rule.target_project_id);
    const workdays = workdaysInPeriod(periodStart, periodEnd);

    return Promise.all(
      assignments
        .filter((a) => !rule.target_user_id || a.user_id === rule.target_user_id)
        .map(async (a): Promise<KpiEvaluatorOutput> => {
          const email = await kpiRepository.findUserEmail(a.user_id);
          if (!email || workdays === 0) {
            return {
              user_id: a.user_id, client_id: null, actual_value: null, target_value: Number(a.planned_pct),
              status: 'unavailable', detail: { reason: 'No user email or empty period' },
            };
          }
          const hours = await calendarRepository.sumProjectHoursForAttendee(
            companyId, rule.target_project_id as string, email, periodStart.toISOString(), periodEnd.toISOString(),
          );
          if (hours === 0) {
            return {
              user_id: a.user_id, client_id: null, actual_value: null, target_value: Number(a.planned_pct),
              status: 'unavailable', detail: { reason: 'No synced calendar events for this project/period' },
            };
          }
          const actualPct = Math.round((hours / (workdays * WORKDAY_HOURS)) * 100 * 100) / 100;
          return {
            user_id: a.user_id, client_id: null, actual_value: actualPct, target_value: Number(a.planned_pct),
            status: 'computed', detail: { hours, workdays },
          };
        }),
    );
  }
}

export const outlookCalendarEvaluator = new OutlookCalendarEvaluator();
