import { db } from '../../core/db';
import { TeamMember, TeamMemberActivity, MemberStats, ProjectAssignment, ProjectMember } from './team.types';

const MEMBER_COLS = 'id, email, first_name, last_name, role, custom_role_title, phone, is_verified, created_at';

class TeamRepository {
  async listMembers(companyId: string): Promise<TeamMember[]> {
    const { rows } = await db.query<TeamMember>(
      `SELECT ${MEMBER_COLS} FROM users WHERE company_id = $1 ORDER BY created_at ASC`,
      [companyId],
    );
    return rows;
  }

  /** Members plus their event counts (single grouped query over the event spine). */
  async listMembersWithActivity(companyId: string): Promise<TeamMemberActivity[]> {
    const { rows } = await db.query<TeamMemberActivity>(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.custom_role_title, u.phone,
              u.is_verified, u.created_at,
              COUNT(e.id)::int AS total_events,
              COUNT(e.id) FILTER (WHERE e.occurred_at > NOW() - INTERVAL '7 days')::int AS events_last_7d,
              MAX(e.occurred_at) AS last_activity_at
       FROM users u
       LEFT JOIN activity_events e ON e.actor_id = u.id AND e.tenant_id = $1
       WHERE u.company_id = $1
       GROUP BY u.id
       ORDER BY u.created_at ASC`,
      [companyId],
    );
    return rows.map((r) => ({
      ...r,
      last_activity_at: r.last_activity_at ? new Date(r.last_activity_at).toISOString() : null,
    }));
  }

  async findMember(id: string, companyId: string): Promise<TeamMember | null> {
    const { rows } = await db.query<TeamMember>(
      `SELECT ${MEMBER_COLS} FROM users WHERE id = $1 AND company_id = $2`,
      [id, companyId],
    );
    return rows[0] ?? null;
  }

  async findMemberByEmail(email: string, companyId: string): Promise<TeamMember | null> {
    const { rows } = await db.query<TeamMember>(
      `SELECT ${MEMBER_COLS} FROM users WHERE email = $1 AND company_id = $2`,
      [email, companyId],
    );
    return rows[0] ?? null;
  }

  async emailExists(email: string): Promise<boolean> {
    const { rows } = await db.query(`SELECT 1 FROM users WHERE email = $1`, [email]);
    return rows.length > 0;
  }

  async createMember(
    companyId: string,
    data: { email: string; password_hash: string; first_name: string; last_name: string; role: string; custom_role_title?: string | null; phone?: string | null },
  ): Promise<TeamMember> {
    const { rows } = await db.query<TeamMember>(
      `INSERT INTO users (company_id, email, password_hash, first_name, last_name, role, custom_role_title, phone, is_verified)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE)
       RETURNING ${MEMBER_COLS}`,
      [
        companyId, data.email, data.password_hash, data.first_name, data.last_name,
        data.role, data.custom_role_title ?? null, data.phone ?? null,
      ],
    );
    return rows[0];
  }

  async updateRole(id: string, companyId: string, role: string): Promise<TeamMember | null> {
    const { rows } = await db.query<TeamMember>(
      `UPDATE users SET role = $3, updated_at = NOW()
       WHERE id = $1 AND company_id = $2 RETURNING ${MEMBER_COLS}`,
      [id, companyId, role],
    );
    return rows[0] ?? null;
  }

  async updateCustomRoleTitle(id: string, companyId: string, title: string | null): Promise<TeamMember | null> {
    const { rows } = await db.query<TeamMember>(
      `UPDATE users SET custom_role_title = $3, updated_at = NOW()
       WHERE id = $1 AND company_id = $2 RETURNING ${MEMBER_COLS}`,
      [id, companyId, title],
    );
    return rows[0] ?? null;
  }

  async deleteMember(id: string, companyId: string): Promise<void> {
    await db.query(`DELETE FROM users WHERE id = $1 AND company_id = $2`, [id, companyId]);
  }

  async memberStats(companyId: string, userId: string): Promise<MemberStats> {
    const [{ rows: totalRows }, { rows: weekRows }, { rows: verbRows }, { rows: lastRows }] =
      await Promise.all([
        db.query<{ count: string }>(
          `SELECT COUNT(*) FROM activity_events WHERE tenant_id = $1 AND actor_id = $2`,
          [companyId, userId],
        ),
        db.query<{ count: string }>(
          `SELECT COUNT(*) FROM activity_events
           WHERE tenant_id = $1 AND actor_id = $2 AND occurred_at > NOW() - INTERVAL '7 days'`,
          [companyId, userId],
        ),
        db.query<{ verb: string; count: string }>(
          `SELECT verb, COUNT(*) AS count FROM activity_events
           WHERE tenant_id = $1 AND actor_id = $2
           GROUP BY verb ORDER BY count DESC LIMIT 10`,
          [companyId, userId],
        ),
        db.query<{ last: Date | null }>(
          `SELECT MAX(occurred_at) AS last FROM activity_events WHERE tenant_id = $1 AND actor_id = $2`,
          [companyId, userId],
        ),
      ]);
    return {
      user_id: userId,
      total_events: parseInt(totalRows[0]?.count ?? '0', 10),
      events_last_7d: parseInt(weekRows[0]?.count ?? '0', 10),
      by_verb: verbRows.map((r) => ({ verb: r.verb, count: parseInt(r.count, 10) })),
      last_activity_at: lastRows[0]?.last ? new Date(lastRows[0].last).toISOString() : null,
    };
  }
  // ── Project assignments ────────────────────────────────────────────────────

  async findProjectCompany(projectId: string): Promise<string | null> {
    const { rows } = await db.query<{ company_id: string }>(
      `SELECT company_id FROM projects WHERE id = $1`, [projectId],
    );
    return rows[0]?.company_id ?? null;
  }

  async listAssignments(userId: string, companyId: string): Promise<ProjectAssignment[]> {
    const { rows } = await db.query<ProjectAssignment>(
      `SELECT * FROM project_assignments WHERE user_id = $1 AND company_id = $2 ORDER BY created_at ASC`,
      [userId, companyId],
    );
    return rows;
  }

  async listAssignmentsByProject(projectId: string, companyId: string): Promise<ProjectAssignment[]> {
    const { rows } = await db.query<ProjectAssignment>(
      `SELECT * FROM project_assignments WHERE project_id = $1 AND company_id = $2 ORDER BY created_at ASC`,
      [projectId, companyId],
    );
    return rows;
  }

  /** Assigned members joined with user identity — used by the project page "people" block. */
  async listProjectMembers(projectId: string, companyId: string): Promise<ProjectMember[]> {
    const { rows } = await db.query<ProjectMember>(
      `SELECT a.id AS assignment_id, u.id AS user_id, u.first_name, u.last_name, u.email,
              u.custom_role_title, a.planned_pct
       FROM project_assignments a
       JOIN users u ON u.id = a.user_id
       WHERE a.project_id = $1 AND a.company_id = $2
       ORDER BY u.first_name ASC`,
      [projectId, companyId],
    );
    return rows;
  }

  async findAssignment(id: string, companyId: string): Promise<ProjectAssignment | null> {
    const { rows } = await db.query<ProjectAssignment>(
      `SELECT * FROM project_assignments WHERE id = $1 AND company_id = $2`,
      [id, companyId],
    );
    return rows[0] ?? null;
  }

  async upsertAssignment(
    companyId: string, projectId: string, userId: string, plannedPct: number,
  ): Promise<ProjectAssignment> {
    const { rows } = await db.query<ProjectAssignment>(
      `INSERT INTO project_assignments (company_id, project_id, user_id, planned_pct)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (project_id, user_id)
       DO UPDATE SET planned_pct = EXCLUDED.planned_pct, updated_at = NOW()
       RETURNING *`,
      [companyId, projectId, userId, plannedPct],
    );
    return rows[0];
  }

  async updateAssignmentPct(id: string, companyId: string, plannedPct: number): Promise<ProjectAssignment | null> {
    const { rows } = await db.query<ProjectAssignment>(
      `UPDATE project_assignments SET planned_pct = $3, updated_at = NOW()
       WHERE id = $1 AND company_id = $2 RETURNING *`,
      [id, companyId, plannedPct],
    );
    return rows[0] ?? null;
  }

  async deleteAssignment(id: string, companyId: string): Promise<void> {
    await db.query(`DELETE FROM project_assignments WHERE id = $1 AND company_id = $2`, [id, companyId]);
  }
}

export const teamRepository = new TeamRepository();
