import { db } from '../../core/db';
import { Folder } from './folders.types';

class FoldersRepository {
  async listFolders(companyId: string): Promise<Folder[]> {
    const { rows } = await db.query<Folder>(
      `SELECT * FROM folders WHERE company_id = $1 ORDER BY sort_order ASC, created_at ASC`,
      [companyId],
    );
    return rows;
  }

  async findFolder(id: string): Promise<Folder | null> {
    const { rows } = await db.query<Folder>(`SELECT * FROM folders WHERE id = $1`, [id]);
    return rows[0] ?? null;
  }

  async findFolderForCompany(id: string, companyId: string): Promise<Folder | null> {
    const { rows } = await db.query<Folder>(
      `SELECT * FROM folders WHERE id = $1 AND company_id = $2`,
      [id, companyId],
    );
    return rows[0] ?? null;
  }

  async createFolder(
    companyId: string, createdBy: string | null,
    data: { name: string; parent_id?: string | null; icon?: string | null; color?: string | null },
  ): Promise<Folder> {
    const { rows } = await db.query<Folder>(
      `INSERT INTO folders (company_id, parent_id, name, icon, color, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [companyId, data.parent_id ?? null, data.name, data.icon ?? null, data.color ?? null, createdBy],
    );
    return rows[0];
  }

  async updateFolder(
    id: string,
    data: { name?: string; icon?: string | null; color?: string | null },
  ): Promise<Folder | null> {
    const { rows } = await db.query<Folder>(
      `UPDATE folders SET
         name       = COALESCE($2, name),
         icon       = COALESCE($3, icon),
         color      = COALESCE($4, color),
         updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [id, data.name ?? null, data.icon ?? null, data.color ?? null],
    );
    return rows[0] ?? null;
  }

  async moveFolder(id: string, parentId: string | null): Promise<Folder | null> {
    const { rows } = await db.query<Folder>(
      `UPDATE folders SET parent_id = $2, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id, parentId],
    );
    return rows[0] ?? null;
  }

  async deleteFolder(id: string): Promise<void> {
    await db.query(`DELETE FROM folders WHERE id = $1`, [id]);
  }
}

export const foldersRepository = new FoldersRepository();
