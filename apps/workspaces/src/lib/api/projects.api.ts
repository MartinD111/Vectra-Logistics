import { apiFetch } from './client';

export interface Project {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  color: string | null;
  folder_id: string | null;
  created_at: string;
  updated_at: string;
  program_count?: number;
}

export interface Program {
  id: string;
  company_id: string;
  project_id: string | null;
  folder_id: string | null;
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

export interface ProjectPage {
  id: string;
  company_id: string;
  project_id: string;
  parent_page_id: string | null;
  title: string;
  icon: string | null;
  is_default: boolean;
  sort_order: number;
  config: Record<string, unknown>;
  cover_image_url: string | null;
  header_settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ActivityEventRow {
  id: string;
  actor_id: string | null;
  verb: string;
  object_type: string;
  object_id: string | null;
  project_id: string | null;
  payload: Record<string, unknown>;
  occurred_at: string;
}

export interface CalendarEvent {
  id: string;
  company_id: string;
  project_id: string | null;
  external_id: string;
  subject: string | null;
  start_at: string;
  end_at: string;
  is_all_day: boolean;
  categories: string[];
  attendee_emails: string[];
  synced_at: string;
}

const BASE = '/api/v1/projects';

export const projectsApi = {
  list: () => apiFetch<{ projects: Project[] }>(BASE).then((r) => r.projects),
  get: (id: string) => apiFetch<{ project: Project }>(`${BASE}/${id}`).then((r) => r.project),
  create: (data: { name: string; description?: string; color?: string; folder_id?: string | null }) =>
    apiFetch<{ project: Project }>(BASE, 'POST', data).then((r) => r.project),
  update: (id: string, data: Partial<{ name: string; description: string | null; color: string | null; folder_id: string | null }>) =>
    apiFetch<{ project: Project }>(`${BASE}/${id}`, 'PATCH', data).then((r) => r.project),
  remove: (id: string) => apiFetch<void>(`${BASE}/${id}`, 'DELETE'),
  archive: (id: string) => apiFetch<{ project: Project }>(`${BASE}/${id}/archive`, 'POST').then((r) => r.project),
  unarchive: (id: string) => apiFetch<{ project: Project }>(`${BASE}/${id}/unarchive`, 'POST').then((r) => r.project),
  stats: (id: string) => apiFetch<{ stats: ProjectStats }>(`${BASE}/${id}/stats`).then((r) => r.stats),

  listPrograms: (projectId?: string) => {
    const qs = projectId ? `?project_id=${projectId}` : '';
    return apiFetch<{ programs: Program[] }>(`${BASE}/programs${qs}`).then((r) => r.programs);
  },
  getProgram: (id: string) =>
    apiFetch<{ program: Program }>(`${BASE}/programs/${id}`).then((r) => r.program),
  createProgram: (data: { name: string; description?: string; type?: string; project_id?: string | null; folder_id?: string | null; config?: Record<string, unknown> }) =>
    apiFetch<{ program: Program }>(`${BASE}/programs`, 'POST', data).then((r) => r.program),
  updateProgram: (id: string, data: Partial<{ name: string; project_id: string | null; folder_id: string | null; status: string; config: Record<string, unknown> }>) =>
    apiFetch<{ program: Program }>(`${BASE}/programs/${id}`, 'PATCH', data).then((r) => r.program),
  removeProgram: (id: string) => apiFetch<void>(`${BASE}/programs/${id}`, 'DELETE'),

  listPages: (projectId: string) =>
    apiFetch<{ pages: ProjectPage[] }>(`${BASE}/${projectId}/pages`).then((r) => r.pages),
  listAllPages: () =>
    apiFetch<{ pages: ProjectPage[] }>(`${BASE}/pages/all`).then((r) => r.pages),
  getPage: (pageId: string) =>
    apiFetch<{ page: ProjectPage }>(`${BASE}/pages/${pageId}`).then((r) => r.page),
  createPage: (projectId: string, data: { title?: string; icon?: string | null; is_default?: boolean; parent_page_id?: string | null; config?: Record<string, unknown>; cover_image_url?: string | null; header_settings?: Record<string, unknown> }) =>
    apiFetch<{ page: ProjectPage }>(`${BASE}/${projectId}/pages`, 'POST', data).then((r) => r.page),
  updatePage: (pageId: string, data: Partial<{ title: string; icon: string | null; is_default: boolean; sort_order: number; parent_page_id: string | null; config: Record<string, unknown>; cover_image_url: string | null; header_settings: Record<string, unknown> }>) =>
    apiFetch<{ page: ProjectPage }>(`${BASE}/pages/${pageId}`, 'PATCH', data).then((r) => r.page),
  removePage: (pageId: string) => apiFetch<void>(`${BASE}/pages/${pageId}`, 'DELETE'),

  listActivity: (projectId: string, opts?: { limit?: number; before?: string }) => {
    const params = new URLSearchParams();
    if (opts?.limit) params.set('limit', String(opts.limit));
    if (opts?.before) params.set('before', opts.before);
    const qs = params.toString();
    return apiFetch<{ activity: ActivityEventRow[] }>(`${BASE}/${projectId}/activity${qs ? `?${qs}` : ''}`)
      .then((r) => r.activity);
  },

  listCalendarEvents: (projectId: string, opts?: { start?: string; end?: string }) => {
    const params = new URLSearchParams();
    if (opts?.start) params.set('start', opts.start);
    if (opts?.end) params.set('end', opts.end);
    const qs = params.toString();
    return apiFetch<{ events: CalendarEvent[] }>(`${BASE}/${projectId}/calendar${qs ? `?${qs}` : ''}`)
      .then((r) => r.events);
  },
};
