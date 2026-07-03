import { apiFetch } from './client';

export interface TeamMember {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  custom_role_title: string | null;
  phone: string | null;
  is_verified: boolean;
  created_at: string;
  total_events: number;
  events_last_7d: number;
  last_activity_at: string | null;
}

export interface ProjectAssignment {
  id: string;
  company_id: string;
  project_id: string;
  user_id: string;
  planned_pct: number;
  created_at: string;
  updated_at: string;
}

export interface MemberStats {
  user_id: string;
  total_events: number;
  events_last_7d: number;
  by_verb: { verb: string; count: number }[];
  last_activity_at: string | null;
}

export interface AddMemberInput {
  email: string;
  first_name: string;
  last_name: string;
  role: 'carrier' | 'shipper' | 'admin';
  password: string;
  phone?: string;
}

const BASE = '/api/v1/team';

export const teamApi = {
  list: () => apiFetch<{ members: TeamMember[] }>(BASE).then((r) => r.members),
  stats: (id: string) => apiFetch<{ stats: MemberStats }>(`${BASE}/${id}/stats`).then((r) => r.stats),
  add: (data: AddMemberInput) =>
    apiFetch<{ member: TeamMember }>(BASE, 'POST', data).then((r) => r.member),
  updateRole: (id: string, role: string) =>
    apiFetch<{ member: TeamMember }>(`${BASE}/${id}/role`, 'PATCH', { role }).then((r) => r.member),
  updateCustomRoleTitle: (id: string, custom_role_title: string | null) =>
    apiFetch<{ member: TeamMember }>(`${BASE}/${id}/custom-role`, 'PATCH', { custom_role_title }).then((r) => r.member),
  remove: (id: string) => apiFetch<void>(`${BASE}/${id}`, 'DELETE'),

  listAssignments: (id: string) =>
    apiFetch<{ assignments: ProjectAssignment[] }>(`${BASE}/${id}/assignments`).then((r) => r.assignments),
  assignProject: (id: string, data: { project_id: string; planned_pct: number }) =>
    apiFetch<{ assignment: ProjectAssignment }>(`${BASE}/${id}/assignments`, 'POST', data).then((r) => r.assignment),
  updateAssignment: (id: string, assignmentId: string, planned_pct: number) =>
    apiFetch<{ assignment: ProjectAssignment }>(`${BASE}/${id}/assignments/${assignmentId}`, 'PATCH', { planned_pct }).then((r) => r.assignment),
  removeAssignment: (id: string, assignmentId: string) =>
    apiFetch<void>(`${BASE}/${id}/assignments/${assignmentId}`, 'DELETE'),
};
