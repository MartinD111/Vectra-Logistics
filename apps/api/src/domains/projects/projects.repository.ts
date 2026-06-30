import { db } from '../../core/db';
import {
  Project, Program, ProjectWithCounts, ProjectStats,
} from './projects.types';

class ProjectsRepository {
  // ── Projects ────────────────────────────────────────────────────────────────

  async listProjects(companyId: string): Promise<ProjectWithCounts[]> {
    const { rows } = await db.query<ProjectWithCounts>(
      `SELECT p.*, COUNT(pr.id)::int AS program_count
       FROM projects p
       LEFT JOIN programs pr ON pr.project_id = p.id
       WHERE p.company_id = $1
       GROUP BY p.id
       ORDER BY p.created_at DESC`,
      [companyId],
    );
    return rows;
  }

  async findProject(id: string): Promise<Project | null> {
    const { rows } = await db.query<Project>(`SELECT * FROM projects WHERE id = $1`, [id]);
    return rows[0] ?? null;
  }

  async createProject(
    companyId: string, createdBy: string | null,
    data: { name: string; description?: string | null; color?: string | null },
  ): Promise<Project> {
    const { rows } = await db.query<Project>(
      `INSERT INTO projects (company_id, name, description, color, created_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [companyId, data.name, data.description ?? null, data.color ?? null, createdBy],
    );
    return rows[0];
  }

  async updateProject(
    id: string,
    data: { name?: string; description?: string | null; color?: string | null },
  ): Promise<Project | null> {
    const { rows } = await db.query<Project>(
      `UPDATE projects SET
         name        = COALESCE($2, name),
         description  = COALESCE($3, description),
         color        = COALESCE($4, color),
         updated_at   = NOW()
       WHERE id = $1 RETURNING *`,
      [id, data.name ?? null, data.description ?? null, data.color ?? null],
    );
    return rows[0] ?? null;
  }

  async deleteProject(id: string): Promise<void> {
    await db.query(`DELETE FROM projects WHERE id = $1`, [id]);
  }

  // ── Programs ────────────────────────────────────────────────────────────────

  async listPrograms(companyId: string, projectId?: string): Promise<Program[]> {
    if (projectId) {
      const { rows } = await db.query<Program>(
        `SELECT * FROM programs WHERE company_id = $1 AND project_id = $2 ORDER BY created_at DESC`,
        [companyId, projectId],
      );
      return rows;
    }
    const { rows } = await db.query<Program>(
      `SELECT * FROM programs WHERE company_id = $1 ORDER BY created_at DESC`,
      [companyId],
    );
    return rows;
  }

  async findProgram(id: string): Promise<Program | null> {
    const { rows } = await db.query<Program>(`SELECT * FROM programs WHERE id = $1`, [id]);
    return rows[0] ?? null;
  }

  async createProgram(
    companyId: string, createdBy: string | null,
    data: { name: string; description?: string | null; type?: string; project_id?: string | null; config?: Record<string, unknown> },
  ): Promise<Program> {
    const { rows } = await db.query<Program>(
      `INSERT INTO programs (company_id, project_id, name, description, type, config, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        companyId, data.project_id ?? null, data.name, data.description ?? null,
        data.type ?? 'transform', JSON.stringify(data.config ?? {}), createdBy,
      ],
    );
    return rows[0];
  }

  async updateProgram(
    id: string,
    data: { name?: string; description?: string | null; project_id?: string | null; status?: string; config?: Record<string, unknown> },
  ): Promise<Program | null> {
    const { rows } = await db.query<Program>(
      `UPDATE programs SET
         name        = COALESCE($2, name),
         description  = COALESCE($3, description),
         project_id   = COALESCE($4, project_id),
         status       = COALESCE($5, status),
         config       = COALESCE($6, config),
         updated_at   = NOW()
       WHERE id = $1 RETURNING *`,
      [
        id, data.name ?? null, data.description ?? null, data.project_id ?? null,
        data.status ?? null, data.config ? JSON.stringify(data.config) : null,
      ],
    );
    return rows[0] ?? null;
  }

  async deleteProgram(id: string): Promise<void> {
    await db.query(`DELETE FROM programs WHERE id = $1`, [id]);
  }

  // ── Per-project statistics (read from the event spine) ───────────────────────

  async projectStats(companyId: string, projectId: string): Promise<ProjectStats> {
    const [{ rows: progRows }, { rows: totalRows }, { rows: weekRows }, { rows: verbRows }, { rows: lastRows }] =
      await Promise.all([
        db.query<{ count: string }>(
          `SELECT COUNT(*) FROM programs WHERE company_id = $1 AND project_id = $2`,
          [companyId, projectId],
        ),
        db.query<{ count: string }>(
          `SELECT COUNT(*) FROM activity_events WHERE tenant_id = $1 AND project_id = $2`,
          [companyId, projectId],
        ),
        db.query<{ count: string }>(
          `SELECT COUNT(*) FROM activity_events
           WHERE tenant_id = $1 AND project_id = $2 AND occurred_at > NOW() - INTERVAL '7 days'`,
          [companyId, projectId],
        ),
        db.query<{ verb: string; count: string }>(
          `SELECT verb, COUNT(*) AS count FROM activity_events
           WHERE tenant_id = $1 AND project_id = $2
           GROUP BY verb ORDER BY count DESC LIMIT 10`,
          [companyId, projectId],
        ),
        db.query<{ last: Date | null }>(
          `SELECT MAX(occurred_at) AS last FROM activity_events WHERE tenant_id = $1 AND project_id = $2`,
          [companyId, projectId],
        ),
      ]);

    return {
      project_id: projectId,
      program_count: parseInt(progRows[0]?.count ?? '0', 10),
      total_events: parseInt(totalRows[0]?.count ?? '0', 10),
      events_last_7d: parseInt(weekRows[0]?.count ?? '0', 10),
      by_verb: verbRows.map((r) => ({ verb: r.verb, count: parseInt(r.count, 10) })),
      last_activity_at: lastRows[0]?.last ? new Date(lastRows[0].last).toISOString() : null,
    };
  }
}

export const projectsRepository = new ProjectsRepository();
