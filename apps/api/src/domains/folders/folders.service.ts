import { db } from '../../core/db';
import { AppError } from '../../core/errors/AppError';
import { recordEvent } from '../../core/events/activityLog';
import { foldersRepository } from './folders.repository';
import { Folder, FolderTree } from './folders.types';
import { CreateFolderSchema, UpdateFolderSchema, MoveFolderSchema } from './dto/folder.dto';

class FoldersService {
  async listFolderTree(companyId: string): Promise<FolderTree[]> {
    const flat = await foldersRepository.listFolders(companyId);
    return this.buildTree(flat, null);
  }

  async getFolder(id: string, companyId: string): Promise<Folder> {
    return this.assertOwnedFolder(id, companyId);
  }

  async createFolder(companyId: string, actorId: string | null, body: unknown): Promise<Folder> {
    const parsed = CreateFolderSchema.safeParse(body);
    if (!parsed.success) throw new AppError(400, parsed.error.issues[0].message);
    let ancestorIds: string[] = [];
    if (parsed.data.parent_id) {
      const parent = await this.assertOwnedFolder(parsed.data.parent_id, companyId);
      ancestorIds = [...parent.ancestor_ids, parent.id];
    }

    const folder = await foldersRepository.createFolder(companyId, actorId, parsed.data, ancestorIds);
    await recordEvent({
      tenantId: companyId, actorId, verb: 'folder.created',
      objectType: 'folder', objectId: folder.id, projectId: null,
      payload: { name: folder.name },
    });
    return folder;
  }

  async updateFolder(id: string, companyId: string, body: unknown): Promise<Folder> {
    await this.assertOwnedFolder(id, companyId);
    const parsed = UpdateFolderSchema.safeParse(body);
    if (!parsed.success) throw new AppError(400, parsed.error.issues[0].message);
    const updated = await foldersRepository.updateFolder(id, parsed.data);
    if (!updated) throw new AppError(404, 'Folder not found');
    return updated;
  }

  async moveFolder(id: string, companyId: string, body: unknown): Promise<Folder> {
    await this.assertOwnedFolder(id, companyId);
    const parsed = MoveFolderSchema.safeParse(body);
    if (!parsed.success) throw new AppError(400, parsed.error.issues[0].message);

    const { parent_id: parentId } = parsed.data;
    let ancestorIds: string[] = [];
    if (parentId) {
      const parent = await this.assertOwnedFolder(parentId, companyId);
      await this.assertNotDescendant(id, parent, companyId);
      ancestorIds = [...parent.ancestor_ids, parent.id];
    }

    const updated = await foldersRepository.moveFolder(id, parentId, ancestorIds);
    if (!updated) throw new AppError(404, 'Folder not found');
    return updated;
  }

  // NOTE: minimal compatibility shim — archives only the folder subtree itself.
  // The full cascade (projects/programs/data_collections within the subtree,
  // RequestContext/event_outbox wiring) is orchestrated in plan 31-05.
  async deleteFolder(id: string, companyId: string): Promise<void> {
    const folder = await this.assertOwnedFolder(id, companyId);
    const ids = await foldersRepository.descendantFolderIds(companyId, folder.id);
    const client = await db.connect();
    try {
      await foldersRepository.archiveFolderSubtree(client, ids, companyId);
    } finally {
      client.release();
    }
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

  /** Reject reparenting a folder underneath itself or one of its own descendants. */
  private async assertNotDescendant(folderId: string, newParent: Folder, companyId: string): Promise<void> {
    let cursor: Folder | null = newParent;
    while (cursor) {
      if (cursor.id === folderId) {
        throw new AppError(400, 'Cannot move a folder into its own descendant');
      }
      cursor = cursor.parent_id ? await this.assertOwnedFolder(cursor.parent_id, companyId) : null;
    }
  }
}

export const foldersService = new FoldersService();
