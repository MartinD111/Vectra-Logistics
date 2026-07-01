// Company team members (users belonging to a company) + per-user KPIs computed
// from the activity_events event spine (actor_id).

export interface TeamMember {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  phone: string | null;
  is_verified: boolean;
  created_at: Date;
}

/** Per-member activity summary for the team overview. */
export interface TeamMemberActivity extends TeamMember {
  total_events: number;
  events_last_7d: number;
  last_activity_at: string | null;
}

/** Detailed KPIs for a single member. */
export interface MemberStats {
  user_id: string;
  total_events: number;
  events_last_7d: number;
  by_verb: { verb: string; count: number }[];
  last_activity_at: string | null;
}
