import { apiFetch } from './client';

export interface Project {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  color: string | null;
  created_at: string;
  updated_at: string;
  program_count?: number;
}

export interface Program {
  id: string;
  company_id: string;
  project_id: string | null;
  name: string;
  description: string | null;
  type: string;
  status: string;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ProjectStats {
  project_id: string;
  program_count: number;
  total_events: number;
  events_last_7d: number;
  by_verb: { verb: string; count: number }[];
  last_activity_at: string | null;
}

const BASE = '/api/v1/projects';

export const projectsApi = {
  list: () => apiFetch<{ projects: Project[] }>(BASE).then((r) => r.projects),
  get: (id: string) => apiFetch<{ project: Project }>(`${BASE}/${id}`).then((r) => r.project),
  create: (data: { name: string; description?: string; color?: string }) =>
    apiFetch<{ project: Project }>(BASE, 'POST', data).then((r) => r.project),
  update: (id: string, data: Partial<{ name: string; description: string | null; color: string | null }>) =>
    apiFetch<{ project: Project }>(`${BASE}/${id}`, 'PATCH', data).then((r) => r.project),
  remove: (id: string) => apiFetch<void>(`${BASE}/${id}`, 'DELETE'),
  stats: (id: string) => apiFetch<{ stats: ProjectStats }>(`${BASE}/${id}/stats`).then((r) => r.stats),

  listPrograms: (projectId?: string) => {
    const qs = projectId ? `?project_id=${projectId}` : '';
    return apiFetch<{ programs: Program[] }>(`${BASE}/programs${qs}`).then((r) => r.programs);
  },
  getProgram: (id: string) =>
    apiFetch<{ program: Program }>(`${BASE}/programs/${id}`).then((r) => r.program),
  createProgram: (data: { name: string; description?: string; type?: string; project_id?: string | null; config?: Record<string, unknown> }) =>
    apiFetch<{ program: Program }>(`${BASE}/programs`, 'POST', data).then((r) => r.program),
  updateProgram: (id: string, data: Partial<{ name: string; project_id: string | null; status: string; config: Record<string, unknown> }>) =>
    apiFetch<{ program: Program }>(`${BASE}/programs/${id}`, 'PATCH', data).then((r) => r.program),
  removeProgram: (id: string) => apiFetch<void>(`${BASE}/programs/${id}`, 'DELETE'),
};
