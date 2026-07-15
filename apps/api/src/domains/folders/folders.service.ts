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
    if (parsed.data.parent_id) await this.assertOwnedFolder(parsed.data.parent_id, companyId);

    const folder = await foldersRepository.createFolder(companyId, actorId, parsed.data);
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
    if (parentId) {
      const parent = await this.assertOwnedFolder(parentId, companyId);
      await this.assertNotDescendant(id, parent, companyId);
    }

    const updated = await foldersRepository.moveFolder(id, parentId);
    if (!updated) throw new AppError(404, 'Folder not found');
    return updated;
  }

  async deleteFolder(id: string, companyId: string): Promise<void> {
    await this.assertOwnedFolder(id, companyId);
    await foldersRepository.deleteFolder(id); // projects/programs.folder_id ON DELETE SET NULL
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
