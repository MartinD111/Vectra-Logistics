import { apiFetch } from './client';

export interface TeamMember {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  phone: string | null;
  is_verified: boolean;
  created_at: string;
  total_events: number;
  events_last_7d: number;
  last_activity_at: string | null;
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
  remove: (id: string) => apiFetch<void>(`${BASE}/${id}`, 'DELETE'),
};
