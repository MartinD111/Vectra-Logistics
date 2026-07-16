import { db } from '../../core/db';
import { AppError } from '../../core/errors/AppError';
import { assertCapability } from '../../core/capabilities';
import { RequestContext, requireCompanyId, requireUserId } from '../../core/auth/request-context';
import { foldersRepository } from './folders.repository';
import { Folder, FolderTree } from './folders.types';
import { CreateFolderSchema, UpdateFolderSchema, MoveFolderSchema } from './dto/folder.dto';

const MAX_FOLDER_DEPTH = 3;

class FoldersService {
  async listFolderTree(ctx: RequestContext): Promise<FolderTree[]> {
    const tenantId = requireCompanyId(ctx);
    const flat = await foldersRepository.listFolders(tenantId);
    return this.buildTree(flat, null);
  }

  async getFolder(ctx: RequestContext, id: string): Promise<Folder> {
    const tenantId = requireCompanyId(ctx);
    return this.assertOwnedFolder(id, tenantId);
  }

  async createFolder(ctx: RequestContext, body: unknown): Promise<Folder> {
    assertCapability(ctx, 'workspace.admin');
    const tenantId = requireCompanyId(ctx);
    const userId = requireUserId(ctx);
    const parsed = CreateFolderSchema.safeParse(body);
    if (!parsed.success) throw new AppError(400, parsed.error.issues[0].message);

    let ancestorIds: string[] = [];
    if (parsed.data.parent_id) {
      const parent = await this.assertOwnedFolder(parsed.data.parent_id, tenantId);
      ancestorIds = [...parent.ancestor_ids, parent.id];
    }

    return foldersRepository.createFolder(tenantId, userId, parsed.data, ancestorIds);
  }

  async updateFolder(ctx: RequestContext, id: string, body: unknown): Promise<Folder> {
    assertCapability(ctx, 'workspace.admin');
    const tenantId = requireCompanyId(ctx);
    await this.assertOwnedFolder(id, tenantId);
    const parsed = UpdateFolderSchema.safeParse(body);
    if (!parsed.success) throw new AppError(400, parsed.error.issues[0].message);
    const updated = await foldersRepository.updateFolder(id, parsed.data);
    if (!updated) throw new AppError(404, 'Folder not found');
    return updated;
  }

  async moveFolder(ctx: RequestContext, id: string, body: unknown): Promise<Folder> {
    assertCapability(ctx, 'workspace.admin');
    const tenantId = requireCompanyId(ctx);
    const folder = await this.assertOwnedFolder(id, tenantId);
    const parsed = MoveFolderSchema.safeParse(body);
    if (!parsed.success) throw new AppError(400, parsed.error.issues[0].message);

    const { parent_id: parentId } = parsed.data;
    let ancestorIds: string[] = [];
    if (parentId) {
      const parent = await this.assertOwnedFolder(parentId, tenantId);
      if (parent.id === id || parent.ancestor_ids.includes(id)) {
        throw new AppError(400, 'Cannot move a folder into its own descendant');
      }
      const newDepth = parent.ancestor_ids.length + 1 + 1;
      if (newDepth > MAX_FOLDER_DEPTH) {
        throw new AppError(400, 'Folder nesting cannot exceed depth 3');
      }
      ancestorIds = [...parent.ancestor_ids, parent.id];
    }

    const updated = await foldersRepository.moveFolder(id, parentId, ancestorIds);
    if (!updated) throw new AppError(404, 'Folder not found');

    const descendantIds = await foldersRepository.descendantFolderIds(tenantId, id);
    const hasDescendants = descendantIds.some((descendantId) => descendantId !== id);
    if (hasDescendants) {
      const client = await db.connect();
      try {
        await client.query('BEGIN');
        await foldersRepository.patchDescendantAncestors(client, id, folder.ancestor_ids, ancestorIds, tenantId);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }

    return updated;
  }

  // ── Internal ──────────────────────────────────────────────────────────────────

  private buildTree(flat: Folder[], parentId: string | null): FolderTree[] {
    return flat
      .filter((f) => f.parent_id === parentId)
      .map((f) => ({ ...f, children: this.buildTree(flat, f.id) }));
  }

  private async assertOwnedFolder(id: string, companyId: string): Promise<Folder> {
    const f = await foldersRepository.findFolderForCompany(id, companyId);
    if (!f) throw new AppError(404, 'Folder not found');
    return f;
  }
}

export const foldersService = new FoldersService();
