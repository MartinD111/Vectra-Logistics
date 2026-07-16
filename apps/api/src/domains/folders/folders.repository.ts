import { PoolClient } from 'pg';
import { db } from '../../core/db';
import { Folder } from './folders.types';

class FoldersRepository {
  async listFolders(companyId: string): Promise<Folder[]> {
    const { rows } = await db.query<Folder>(
      `SELECT * FROM folders WHERE company_id = $1 AND archived_at IS NULL ORDER BY sort_order ASC, created_at ASC`,
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
      `SELECT * FROM folders WHERE id = $1 AND company_id = $2 AND archived_at IS NULL`,
      [id, companyId],
    );
    return rows[0] ?? null;
  }

  async findFoldersByIds(companyId: string, ids: string[]): Promise<Folder[]> {
    const { rows } = await db.query<Folder>(
      `SELECT * FROM folders WHERE company_id = $1 AND id = ANY($2::uuid[])`,
      [companyId, ids],
    );
    return rows;
  }

  async descendantFolderIds(companyId: string, folderId: string): Promise<string[]> {
    const { rows } = await db.query<{ id: string }>(
      `SELECT id FROM folders WHERE company_id = $1 AND (id = $2 OR ancestor_ids @> ARRAY[$2]::uuid[])`,
      [companyId, folderId],
    );
    return rows.map((r) => r.id);
  }

  async createFolder(
    companyId: string, createdBy: string | null,
    data: { name: string; parent_id?: string | null; icon?: string | null; color?: string | null },
    ancestorIds: string[],
  ): Promise<Folder> {
    const { rows } = await db.query<Folder>(
      `INSERT INTO folders (company_id, parent_id, name, icon, color, ancestor_ids, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [companyId, data.parent_id ?? null, data.name, data.icon ?? null, data.color ?? null, ancestorIds, createdBy],
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

  async moveFolder(id: string, parentId: string | null, ancestorIds: string[]): Promise<Folder | null> {
    const { rows } = await db.query<Folder>(
      `UPDATE folders SET parent_id = $2, ancestor_ids = $3, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id, parentId, ancestorIds],
    );
    return rows[0] ?? null;
  }

  /**
   * Rewrites the ancestor_ids prefix (up to and including folderId) on every
   * descendant of folderId in one query, preserving whatever chain each
   * descendant has below folderId. Bounded to at most 2 extra levels given
   * max depth 3, so this is cheap despite touching every descendant row.
   */
  async patchDescendantAncestors(
    client: PoolClient, folderId: string, oldAncestorIds: string[], newAncestorIds: string[], companyId: string,
  ): Promise<void> {
    await client.query(
      `UPDATE folders SET
         ancestor_ids = $3 || ancestor_ids[array_position(ancestor_ids, $4::uuid):],
         updated_at = NOW()
       WHERE company_id = $1 AND ancestor_ids @> ARRAY[$4]::uuid[]`,
      [companyId, folderId, newAncestorIds, folderId],
    );
  }

  async archiveFolderSubtree(client: PoolClient, folderIds: string[], companyId: string): Promise<Folder[]> {
    const { rows } = await client.query<Folder>(
      `UPDATE folders SET archived_at = NOW(), updated_at = NOW()
       WHERE company_id = $1 AND id = ANY($2::uuid[]) AND archived_at IS NULL RETURNING *`,
      [companyId, folderIds],
    );
    return rows;
  }

  async unarchiveFolder(id: string, companyId: string): Promise<Folder | null> {
    const { rows } = await db.query<Folder>(
      `UPDATE folders SET archived_at = NULL, updated_at = NOW() WHERE id = $1 AND company_id = $2 RETURNING *`,
      [id, companyId],
    );
    return rows[0] ?? null;
  }
}

export const foldersRepository = new FoldersRepository();
