import { db } from '../../core/db';
import { KpiRule, KpiResult, KpiResultWithRule } from './kpi.types';

class KpiRepository {
  // ── Rules ────────────────────────────────────────────────────────────────────

  async listRules(companyId: string): Promise<KpiRule[]> {
    const { rows } = await db.query<KpiRule>(
      `SELECT * FROM kpi_rules WHERE company_id = $1 ORDER BY created_at DESC`,
      [companyId],
    );
    return rows;
  }

  async listActiveRules(companyId: string): Promise<KpiRule[]> {
    const { rows } = await db.query<KpiRule>(
      `SELECT * FROM kpi_rules WHERE company_id = $1 AND is_active = TRUE ORDER BY created_at DESC`,
      [companyId],
    );
    return rows;
  }

  async findRule(id: string): Promise<KpiRule | null> {
    const { rows } = await db.query<KpiRule>(`SELECT * FROM kpi_rules WHERE id = $1`, [id]);
    return rows[0] ?? null;
  }

  async createRule(
    companyId: string, createdBy: string | null,
    data: {
      name: string; description?: string | null; source_type: string;
      target_project_id?: string | null; target_user_id?: string | null;
      condition?: Record<string, unknown>; weight?: number; threshold?: number | null; is_active?: boolean;
    },
  ): Promise<KpiRule> {
    const { rows } = await db.query<KpiRule>(
      `INSERT INTO kpi_rules
         (company_id, name, description, source_type, target_project_id, target_user_id, condition, weight, threshold, is_active, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [
        companyId, data.name, data.description ?? null, data.source_type,
        data.target_project_id ?? null, data.target_user_id ?? null,
        JSON.stringify(data.condition ?? {}), data.weight ?? 1, data.threshold ?? null,
        data.is_active ?? true, createdBy,
      ],
    );
    return rows[0];
  }

  async updateRule(
    id: string,
    data: {
      name?: string; description?: string | null; source_type?: string;
      target_project_id?: string | null; target_user_id?: string | null;
      condition?: Record<string, unknown>; weight?: number; threshold?: number | null; is_active?: boolean;
    },
  ): Promise<KpiRule | null> {
    const { rows } = await db.query<KpiRule>(
      `UPDATE kpi_rules SET
         name              = COALESCE($2, name),
         description       = COALESCE($3, description),
         source_type       = COALESCE($4, source_type),
         target_project_id = COALESCE($5, target_project_id),
         target_user_id    = COALESCE($6, target_user_id),
         condition         = COALESCE($7, condition),
         weight            = COALESCE($8, weight),
         threshold         = COALESCE($9, threshold),
         is_active         = COALESCE($10, is_active),
         updated_at        = NOW()
       WHERE id = $1 RETURNING *`,
      [
        id, data.name ?? null, data.description ?? null, data.source_type ?? null,
        data.target_project_id ?? null, data.target_user_id ?? null,
        data.condition ? JSON.stringify(data.condition) : null,
        data.weight ?? null, data.threshold ?? null, data.is_active ?? null,
      ],
    );
    return rows[0] ?? null;
  }

  async deleteRule(id: string): Promise<void> {
    await db.query(`DELETE FROM kpi_rules WHERE id = $1`, [id]);
  }

  // ── Results ──────────────────────────────────────────────────────────────────

  async listResults(
    companyId: string,
    filters: { ruleId?: string; userId?: string; projectId?: string },
  ): Promise<KpiResult[]> {
    const clauses = ['r.company_id = $1'];
    const params: unknown[] = [companyId];

    if (filters.ruleId) {
      params.push(filters.ruleId);
      clauses.push(`r.rule_id = $${params.length}`);
    }
    if (filters.userId) {
      params.push(filters.userId);
      clauses.push(`r.user_id = $${params.length}`);
    }
    if (filters.projectId) {
      params.push(filters.projectId);
      clauses.push(`k.target_project_id = $${params.length}`);
    }

    const { rows } = await db.query<KpiResult>(
      `SELECT r.* FROM kpi_results r
       JOIN kpi_rules k ON k.id = r.rule_id
       WHERE ${clauses.join(' AND ')}
       ORDER BY r.period_start DESC`,
      params,
    );
    return rows;
  }

  /** Same filters as listResults, joined with rule name/source_type for summary views. */
  async listResultsWithRuleInfo(
    companyId: string,
    filters: { ruleId?: string; userId?: string; projectId?: string },
  ): Promise<KpiResultWithRule[]> {
    const clauses = ['r.company_id = $1'];
    const params: unknown[] = [companyId];

    if (filters.ruleId) {
      params.push(filters.ruleId);
      clauses.push(`r.rule_id = $${params.length}`);
    }
    if (filters.userId) {
      params.push(filters.userId);
      clauses.push(`r.user_id = $${params.length}`);
    }
    if (filters.projectId) {
      params.push(filters.projectId);
      clauses.push(`k.target_project_id = $${params.length}`);
    }

    const { rows } = await db.query<KpiResultWithRule>(
      `SELECT r.*, k.name AS rule_name, k.source_type FROM kpi_results r
       JOIN kpi_rules k ON k.id = r.rule_id
       WHERE ${clauses.join(' AND ')}
       ORDER BY r.period_start DESC`,
      params,
    );
    return rows;
  }

  async upsertResult(
    companyId: string, ruleId: string,
    data: {
      user_id: string; period_start: string; period_end: string;
      actual_value: number | null; target_value: number | null; status: string; detail: Record<string, unknown>;
    },
  ): Promise<KpiResult> {
    const { rows } = await db.query<KpiResult>(
      `INSERT INTO kpi_results
         (company_id, rule_id, user_id, period_start, period_end, actual_value, target_value, status, detail, computed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
       RETURNING *`,
      [
        companyId, ruleId, data.user_id, data.period_start, data.period_end,
        data.actual_value, data.target_value, data.status, JSON.stringify(data.detail),
      ],
    );
    return rows[0];
  }
  // ── Cross-domain lookups used by evaluators (kept here, not imported from
  //    other domains' repositories, to avoid cross-domain coupling) ────────────

  async findProjectCompany(projectId: string): Promise<string | null> {
    const { rows } = await db.query<{ company_id: string }>(
      `SELECT company_id FROM projects WHERE id = $1`, [projectId],
    );
    return rows[0]?.company_id ?? null;
  }

  async findUserCompany(userId: string): Promise<string | null> {
    const { rows } = await db.query<{ company_id: string }>(
      `SELECT company_id FROM users WHERE id = $1`, [userId],
    );
    return rows[0]?.company_id ?? null;
  }

  async listProjectAssignmentUsers(projectId: string): Promise<{ user_id: string; planned_pct: number }[]> {
    const { rows } = await db.query<{ user_id: string; planned_pct: number }>(
      `SELECT user_id, planned_pct FROM project_assignments WHERE project_id = $1`,
      [projectId],
    );
    return rows;
  }

  async findUserEmail(userId: string): Promise<string | null> {
    const { rows } = await db.query<{ email: string }>(`SELECT email FROM users WHERE id = $1`, [userId]);
    return rows[0]?.email ?? null;
  }

  async countActivityEvents(
    companyId: string, userId: string, periodStart: string, periodEnd: string,
  ): Promise<number> {
    const { rows } = await db.query<{ count: string }>(
      `SELECT COUNT(*) FROM activity_events
       WHERE tenant_id = $1 AND actor_id = $2 AND occurred_at >= $3 AND occurred_at < $4`,
      [companyId, userId, periodStart, periodEnd],
    );
    return parseInt(rows[0]?.count ?? '0', 10);
  }
}

export const kpiRepository = new KpiRepository();
