// Projects organize a tenant's programs and provide automatic per-project
// statistics (read from the activity_events event spine via project_id).

export interface Project {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  color: string | null;
  folder_id: string | null;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
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
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface ProjectWithCounts extends Project {
  program_count: number;
}

/** Automatic per-project statistics, computed from the event spine. */
export interface ProjectStats {
  project_id: string;
  program_count: number;
  total_events: number;
  events_last_7d: number;
  by_verb: { verb: string; count: number }[];
  last_activity_at: string | null;
}
