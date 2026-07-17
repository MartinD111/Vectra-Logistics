import { db } from '../../core/db';
import { AppError } from '../../core/errors/AppError';
import { assertCapability } from '../../core/capabilities';
import { RequestContext, requireCompanyId, requireUserId } from '../../core/auth/request-context';
import { createDurableEventEnvelope, insertDurableEvent } from '../../core/events/outbox';
import { foldersRepository } from './folders.repository';
import { projectsRepository } from '../projects/projects.repository';
import { recordsRepository } from '../records/records.repository';
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

  async archiveFolder(ctx: RequestContext, id: string): Promise<Folder> {
    assertCapability(ctx, 'workspace.admin');
    const tenantId = requireCompanyId(ctx);
    const userId = requireUserId(ctx);
    await this.assertOwnedFolder(id, tenantId);

    const client = await db.connect();
    try {
      await client.query('BEGIN');

      const folderIds = await foldersRepository.descendantFolderIds(tenantId, id);

      const archivedFolders = await foldersRepository.archiveFolderSubtree(client, folderIds, tenantId);
      for (const row of archivedFolders) {
        await insertDurableEvent(client, createDurableEventEnvelope({
          eventName: 'folder.archived',
          tenantId,
          actorId: userId,
          objectType: 'folder',
          objectId: row.id,
          correlationId: ctx.requestId,
          payloadVersion: 1,
          payload: { name: row.name },
        }));
      }

      // Pass 1 — rows filed directly into one of the archived folders.
      const archivedProjects = await projectsRepository.archiveProjectsInFolders(client, folderIds, tenantId);
      for (const row of archivedProjects) {
        await insertDurableEvent(client, createDurableEventEnvelope({
          eventName: 'project.archived',
          tenantId,
          actorId: userId,
          objectType: 'project',
          objectId: row.id,
          correlationId: ctx.requestId,
          payloadVersion: 1,
          payload: { name: row.name },
        }));
      }

      const archivedProgramsDirect = await projectsRepository.archiveProgramsInFolders(client, folderIds, tenantId);
      for (const row of archivedProgramsDirect) {
        await insertDurableEvent(client, createDurableEventEnvelope({
          eventName: 'program.archived',
          tenantId,
          actorId: userId,
          objectType: 'program',
          objectId: row.id,
          correlationId: ctx.requestId,
          payloadVersion: 1,
          payload: { name: row.name },
        }));
      }

      // archiveCollectionsInFolders emits its own durable event per row internally.
      await recordsRepository.archiveCollectionsInFolders(client, folderIds, tenantId);

      // Pass 2 — rows attached via the just-archived projects' project_id.
      const archivedProjectIds = archivedProjects.map((project) => project.id);
      if (archivedProjectIds.length > 0) {
        const archivedProgramsViaProject = await projectsRepository.archiveProgramsInProjects(client, archivedProjectIds, tenantId);
        for (const row of archivedProgramsViaProject) {
          await insertDurableEvent(client, createDurableEventEnvelope({
            eventName: 'program.archived',
            tenantId,
            actorId: userId,
            objectType: 'program',
            objectId: row.id,
            correlationId: ctx.requestId,
            payloadVersion: 1,
            payload: { name: row.name },
          }));
        }

        const archivedPages = await projectsRepository.archivePagesInProjects(client, archivedProjectIds, tenantId);
        for (const row of archivedPages) {
          await insertDurableEvent(client, createDurableEventEnvelope({
            eventName: 'project_page.archived',
            tenantId,
            actorId: userId,
            objectType: 'project_page',
            objectId: row.id,
            correlationId: ctx.requestId,
            payloadVersion: 1,
            payload: { title: row.title },
          }));
        }

        // archiveCollectionsInProjects emits its own durable event per row internally.
        await recordsRepository.archiveCollectionsInProjects(client, archivedProjectIds, tenantId);
      }

      const updated = archivedFolders.find((f) => f.id === id);
      if (!updated) throw new AppError(404, 'Folder not found');

      await client.query('COMMIT');
      return updated;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async unarchiveFolder(ctx: RequestContext, id: string): Promise<Folder> {
    assertCapability(ctx, 'workspace.admin');
    const tenantId = requireCompanyId(ctx);
    const userId = requireUserId(ctx);

    const updated = await foldersRepository.unarchiveFolder(id, tenantId);
    if (!updated) throw new AppError(404, 'Folder not found');

    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await insertDurableEvent(client, createDurableEventEnvelope({
        eventName: 'folder.unarchived',
        tenantId,
        actorId: userId,
        objectType: 'folder',
        objectId: updated.id,
        correlationId: ctx.requestId,
        payloadVersion: 1,
        payload: { name: updated.name },
      }));
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
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
