import type { PoolClient } from 'pg';
import { db } from '../../core/db';
import {
  Project, Program, ProjectWithCounts, ProjectStats, ProjectPage, ActivityEventRow,
} from './projects.types';

class ProjectsRepository {
  // ── Projects ────────────────────────────────────────────────────────────────

  async listProjects(companyId: string): Promise<ProjectWithCounts[]> {
    const { rows } = await db.query<ProjectWithCounts>(
      `SELECT p.*, COUNT(pr.id)::int AS program_count
       FROM projects p
       LEFT JOIN programs pr ON pr.project_id = p.id
       WHERE p.company_id = $1 AND p.archived_at IS NULL
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

  async findProjectForCompany(id: string, companyId: string): Promise<Project | null> {
    const { rows } = await db.query<Project>(
      `SELECT * FROM projects WHERE id = $1 AND company_id = $2 AND archived_at IS NULL`,
      [id, companyId],
    );
    return rows[0] ?? null;
  }

  async createProject(
    companyId: string, createdBy: string | null,
    data: { name: string; description?: string | null; color?: string | null; folder_id?: string | null },
  ): Promise<Project> {
    const { rows } = await db.query<Project>(
      `INSERT INTO projects (company_id, name, description, color, folder_id, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [companyId, data.name, data.description ?? null, data.color ?? null, data.folder_id ?? null, createdBy],
    );
    return rows[0];
  }

  async updateProject(
    id: string,
    data: { name?: string; description?: string | null; color?: string | null; folder_id?: string | null },
  ): Promise<Project | null> {
    const { rows } = await db.query<Project>(
      `UPDATE projects SET
         name        = COALESCE($2, name),
         description  = COALESCE($3, description),
         color        = COALESCE($4, color),
         folder_id    = COALESCE($5, folder_id),
         updated_at   = NOW()
       WHERE id = $1 RETURNING *`,
      [id, data.name ?? null, data.description ?? null, data.color ?? null, data.folder_id ?? null],
    );
    return rows[0] ?? null;
  }

  async archiveProject(id: string): Promise<Project | null> {
    const { rows } = await db.query<Project>(
      `UPDATE projects SET archived_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND archived_at IS NULL RETURNING *`,
      [id],
    );
    return rows[0] ?? null;
  }

  async unarchiveProject(id: string): Promise<Project | null> {
    const { rows } = await db.query<Project>(
      `UPDATE projects SET archived_at = NULL, updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [id],
    );
    return rows[0] ?? null;
  }

  // ── Programs ────────────────────────────────────────────────────────────────

  async listPrograms(companyId: string, projectId?: string): Promise<Program[]> {
    if (projectId) {
      const { rows } = await db.query<Program>(
        `SELECT * FROM programs WHERE company_id = $1 AND project_id = $2 AND archived_at IS NULL ORDER BY created_at DESC`,
        [companyId, projectId],
      );
      return rows;
    }
    const { rows } = await db.query<Program>(
      `SELECT * FROM programs WHERE company_id = $1 AND archived_at IS NULL ORDER BY created_at DESC`,
      [companyId],
    );
    return rows;
  }

  async findProgram(id: string): Promise<Program | null> {
    const { rows } = await db.query<Program>(`SELECT * FROM programs WHERE id = $1`, [id]);
    return rows[0] ?? null;
  }

  async findProgramForCompany(id: string, companyId: string): Promise<Program | null> {
    const { rows } = await db.query<Program>(
      `SELECT * FROM programs WHERE id = $1 AND company_id = $2 AND archived_at IS NULL`,
      [id, companyId],
    );
    return rows[0] ?? null;
  }

  async createProgram(
    companyId: string, createdBy: string | null,
    data: { name: string; description?: string | null; type?: string; project_id?: string | null; folder_id?: string | null; config?: Record<string, unknown> },
  ): Promise<Program> {
    const { rows } = await db.query<Program>(
      `INSERT INTO programs (company_id, project_id, folder_id, name, description, type, config, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        companyId, data.project_id ?? null, data.folder_id ?? null, data.name, data.description ?? null,
        data.type ?? 'transform', JSON.stringify(data.config ?? {}), createdBy,
      ],
    );
    return rows[0];
  }

  async updateProgram(
    id: string,
    data: { name?: string; description?: string | null; project_id?: string | null; folder_id?: string | null; status?: string; config?: Record<string, unknown> },
  ): Promise<Program | null> {
    const { rows } = await db.query<Program>(
      `UPDATE programs SET
         name        = COALESCE($2, name),
         description  = COALESCE($3, description),
         project_id   = COALESCE($4, project_id),
         folder_id    = COALESCE($5, folder_id),
         status       = COALESCE($6, status),
         config       = COALESCE($7, config),
         updated_at   = NOW()
       WHERE id = $1 RETURNING *`,
      [
        id, data.name ?? null, data.description ?? null, data.project_id ?? null,
        data.folder_id ?? null, data.status ?? null, data.config ? JSON.stringify(data.config) : null,
      ],
    );
    return rows[0] ?? null;
  }

  async archiveProgram(id: string): Promise<Program | null> {
    const { rows } = await db.query<Program>(
      `UPDATE programs SET archived_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND archived_at IS NULL RETURNING *`,
      [id],
    );
    return rows[0] ?? null;
  }

  async unarchiveProgram(id: string): Promise<Program | null> {
    const { rows } = await db.query<Program>(
      `UPDATE programs SET archived_at = NULL, updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [id],
    );
    return rows[0] ?? null;
  }

  // ── Bulk cascade-archive (used by the folders-domain archive cascade) ────────

  async archiveProjectsInFolders(client: PoolClient, folderIds: string[], companyId: string): Promise<Project[]> {
    const { rows } = await client.query<Project>(
      `UPDATE projects SET archived_at = NOW(), updated_at = NOW()
       WHERE company_id = $1 AND folder_id = ANY($2::uuid[]) AND archived_at IS NULL
       RETURNING *`,
      [companyId, folderIds],
    );
    return rows;
  }

  async archiveProgramsInFolders(client: PoolClient, folderIds: string[], companyId: string): Promise<Program[]> {
    const { rows } = await client.query<Program>(
      `UPDATE programs SET archived_at = NOW(), updated_at = NOW()
       WHERE company_id = $1 AND folder_id = ANY($2::uuid[]) AND archived_at IS NULL
       RETURNING *`,
      [companyId, folderIds],
    );
    return rows;
  }

  async archiveProgramsInProjects(client: PoolClient, projectIds: string[], companyId: string): Promise<Program[]> {
    const { rows } = await client.query<Program>(
      `UPDATE programs SET archived_at = NOW(), updated_at = NOW()
       WHERE company_id = $1 AND project_id = ANY($2::uuid[]) AND archived_at IS NULL
       RETURNING *`,
      [companyId, projectIds],
    );
    return rows;
  }

  async archivePagesInProjects(client: PoolClient, projectIds: string[], companyId: string): Promise<ProjectPage[]> {
    const { rows } = await client.query<ProjectPage>(
      `UPDATE project_pages SET archived_at = NOW(), updated_at = NOW()
       WHERE company_id = $1 AND project_id = ANY($2::uuid[]) AND archived_at IS NULL
       RETURNING *`,
      [companyId, projectIds],
    );
    return rows;
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

  // ── Project pages ─────────────────────────────────────────────────────────────

  async listPages(companyId: string, projectId: string): Promise<ProjectPage[]> {
    const { rows } = await db.query<ProjectPage>(
      `SELECT * FROM project_pages WHERE company_id = $1 AND project_id = $2
       ORDER BY sort_order ASC, created_at ASC`,
      [companyId, projectId],
    );
    return rows;
  }

  async findPage(id: string): Promise<ProjectPage | null> {
    const { rows } = await db.query<ProjectPage>(`SELECT * FROM project_pages WHERE id = $1`, [id]);
    return rows[0] ?? null;
  }

  async findPageForCompany(id: string, companyId: string): Promise<ProjectPage | null> {
    const { rows } = await db.query<ProjectPage>(
      `SELECT * FROM project_pages WHERE id = $1 AND company_id = $2`,
      [id, companyId],
    );
    return rows[0] ?? null;
  }

  async createPage(
    companyId: string, projectId: string, createdBy: string | null,
    data: {
      title?: string; icon?: string | null; is_default?: boolean; parent_page_id?: string | null;
      config?: Record<string, unknown>; cover_image_url?: string | null; header_settings?: Record<string, unknown>;
    },
  ): Promise<ProjectPage> {
    const { rows: sortRows } = await db.query<{ next: number }>(
      `SELECT COALESCE(MAX(sort_order) + 1, 0) AS next FROM project_pages WHERE project_id = $1`,
      [projectId],
    );
    if (data.is_default) {
      await db.query(
        `UPDATE project_pages SET is_default = FALSE WHERE project_id = $1`,
        [projectId],
      );
    }
    const { rows } = await db.query<ProjectPage>(
      `INSERT INTO project_pages (company_id, project_id, parent_page_id, title, icon, is_default, sort_order, config, cover_image_url, header_settings, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [
        companyId, projectId, data.parent_page_id ?? null, data.title ?? 'Untitled', data.icon ?? null, data.is_default ?? false,
        sortRows[0].next, JSON.stringify(data.config ?? { version: 1, blocks: [] }),
        data.cover_image_url ?? null, JSON.stringify(data.header_settings ?? {}), createdBy,
      ],
    );
    return rows[0];
  }

  async updatePage(
    id: string, projectId: string,
    data: {
      title?: string; icon?: string | null; is_default?: boolean; sort_order?: number; parent_page_id?: string | null;
      config?: Record<string, unknown>; cover_image_url?: string | null; header_settings?: Record<string, unknown>;
    },
  ): Promise<ProjectPage | null> {
    if (data.is_default) {
      await db.query(
        `UPDATE project_pages SET is_default = FALSE WHERE project_id = $1 AND id != $2`,
        [projectId, id],
      );
    }
    // Nullable fields use a provided-flag + CASE so an explicit null clears the
    // value; COALESCE alone could never reset them.
    const { rows } = await db.query<ProjectPage>(
      `UPDATE project_pages SET
         title           = COALESCE($2, title),
         icon            = CASE WHEN $3::boolean THEN $4 ELSE icon END,
         is_default      = COALESCE($5, is_default),
         sort_order      = COALESCE($6, sort_order),
         config          = COALESCE($7, config),
         parent_page_id  = CASE WHEN $8::boolean THEN $9::uuid ELSE parent_page_id END,
         cover_image_url = CASE WHEN $10::boolean THEN $11 ELSE cover_image_url END,
         header_settings = COALESCE($12, header_settings),
         updated_at      = NOW()
       WHERE id = $1 RETURNING *`,
      [
        id, data.title ?? null,
        data.icon !== undefined, data.icon ?? null,
        data.is_default ?? null, data.sort_order ?? null,
        data.config ? JSON.stringify(data.config) : null,
        data.parent_page_id !== undefined, data.parent_page_id ?? null,
        data.cover_image_url !== undefined, data.cover_image_url ?? null,
        data.header_settings ? JSON.stringify(data.header_settings) : null,
      ],
    );
    return rows[0] ?? null;
  }

  async listAllPages(companyId: string): Promise<ProjectPage[]> {
    const { rows } = await db.query<ProjectPage>(
      `SELECT * FROM project_pages WHERE company_id = $1 ORDER BY project_id, sort_order ASC, created_at ASC`,
      [companyId],
    );
    return rows;
  }

  async deletePage(id: string): Promise<void> {
    await db.query(`DELETE FROM project_pages WHERE id = $1`, [id]);
  }

  // ── Project activity feed (paginated raw event feed) ──────────────────────────

  async listActivity(
    companyId: string, projectId: string, opts: { limit: number; before?: string | null },
  ): Promise<ActivityEventRow[]> {
    const params: unknown[] = [companyId, projectId];
    let where = `tenant_id = $1 AND project_id = $2`;
    if (opts.before) {
      params.push(opts.before);
      where += ` AND occurred_at < $${params.length}`;
    }
    params.push(opts.limit);
    const { rows } = await db.query<ActivityEventRow>(
      `SELECT id, actor_id, verb, object_type, object_id, project_id, payload, occurred_at
       FROM activity_events WHERE ${where}
       ORDER BY occurred_at DESC LIMIT $${params.length}`,
      params,
    );
    return rows;
  }
}

export const projectsRepository = new ProjectsRepository();
