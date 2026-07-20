import { db } from '../../core/db';
import { AppError } from '../../core/errors/AppError';
import { assertCapability } from '../../core/capabilities';
import { RequestContext, requireCompanyId, requireUserId } from '../../core/auth/request-context';
import { createDurableEventEnvelope, insertDurableEvent } from '../../core/events/outbox';
import { foldersRepository } from './folders.repository';
import { projectsRepository } from '../projects/projects.repository';
import { recordsRepository } from '../records/records.repository';
import { Folder, FolderTree, TreeNode } from './folders.types';
import { CreateFolderSchema, UpdateFolderSchema, MoveFolderSchema } from './dto/folder.dto';
import { ReorderNodesSchema, ReorderNodesDto, MoveNodeSchema } from './dto/tree.dto';
import type { Project, Program, ProjectPage } from '../projects/projects.types';
import type { DataCollectionRow } from '../records/records.types';

type MoveNodeResult = Folder | Project | Program | DataCollectionRow;

const MAX_FOLDER_DEPTH = 3;

class FoldersService {
  async listFolderTree(ctx: RequestContext): Promise<FolderTree[]> {
    const tenantId = requireCompanyId(ctx);
    const flat = await foldersRepository.listFolders(tenantId);
    return this.buildTree(flat, null);
  }

  // TREEAPI-01: aggregated tree read — exactly 5 flat, company-scoped queries
  // run in parallel, then nested in memory. No per-node fan-out queries.
  async getFullTree(ctx: RequestContext): Promise<TreeNode[]> {
    const tenantId = requireCompanyId(ctx);
    const [folders, projects, programs, pages, collections] = await Promise.all([
      foldersRepository.listFolders(tenantId),
      projectsRepository.listProjects(tenantId),
      projectsRepository.listPrograms(tenantId),
      projectsRepository.listAllPages(tenantId),
      recordsRepository.listCollections(tenantId),
    ]);
    return this.assembleTree(folders, projects, programs, pages, collections);
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

    // Descendant depth must be re-validated here, not just the moved folder's
    // own depth above: the DB trigger only fires on parent_id updates, never
    // on the ancestor_ids-only rewrite patchDescendantAncestors performs
    // below, so a descendant could otherwise be silently pushed past
    // MAX_FOLDER_DEPTH.
    const descendantIds = (await foldersRepository.descendantFolderIds(tenantId, id))
      .filter((descendantId) => descendantId !== id);

    if (descendantIds.length > 0) {
      const descendantFolders = await foldersRepository.findFoldersByIds(tenantId, descendantIds);
      const newOwnDepth = ancestorIds.length + 1;
      const maxDescendantRelDepth = descendantFolders.reduce(
        (max, d) => Math.max(max, d.ancestor_ids.length - folder.ancestor_ids.length),
        0,
      );
      if (newOwnDepth + maxDescendantRelDepth > MAX_FOLDER_DEPTH) {
        throw new AppError(400, 'Folder nesting cannot exceed depth 3');
      }
    }

    // A leaf folder (no descendants) has nothing to coordinate atomically —
    // move it directly on the ambient pool, same as before.
    if (descendantIds.length === 0) {
      const updated = await foldersRepository.moveFolder(id, parentId, ancestorIds);
      if (!updated) throw new AppError(404, 'Folder not found');
      return updated;
    }

    // The folder's own row and its descendants' ancestor_ids must commit
    // atomically — a mid-cascade failure must not leave descendants with
    // stale ancestor_ids while the folder itself has already moved.
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      const updated = await foldersRepository.moveFolderTx(client, id, parentId, ancestorIds);
      if (!updated) throw new AppError(404, 'Folder not found');
      await foldersRepository.patchDescendantAncestors(client, id, folder.ancestor_ids, ancestorIds, tenantId);
      await client.query('COMMIT');
      return updated;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // TREEAPI-03: capability-gated node reparent — dispatches by node_type (and
  // by the project_id disambiguator for programs) to the existing per-domain
  // ownership-checked update paths. The 'folder' branch is a single
  // delegating call to moveFolder, never a duplicate cycle-check
  // implementation — Phase 31's cycle/depth detection lives in one place.
  async moveNode(ctx: RequestContext, body: unknown): Promise<MoveNodeResult> {
    assertCapability(ctx, 'workspace.admin');
    const tenantId = requireCompanyId(ctx);
    const parsed = MoveNodeSchema.safeParse(body);
    if (!parsed.success) throw new AppError(400, parsed.error.issues[0].message);

    const { node_type: nodeType, node_id: nodeId, new_parent_id: newParentId, project_id: projectId } = parsed.data;

    switch (nodeType) {
      case 'folder':
        return this.moveFolder(ctx, nodeId, { parent_id: newParentId });

      case 'project': {
        const owned = await projectsRepository.findProjectForCompany(nodeId, tenantId);
        if (!owned) throw new AppError(404, 'Project not found');
        if (newParentId) await this.assertOwnedFolder(newParentId, tenantId);
        const updated = await projectsRepository.setProjectFolder(nodeId, tenantId, newParentId);
        if (!updated) throw new AppError(404, 'Project not found');
        return updated;
      }

      case 'program': {
        const owned = await projectsRepository.findProgramForCompany(nodeId, tenantId);
        if (!owned) throw new AppError(404, 'Program not found');

        if (projectId) {
          const destProject = await projectsRepository.findProjectForCompany(projectId, tenantId);
          if (!destProject) throw new AppError(404, 'Project not found');
          const updated = await projectsRepository.setProgramParent(nodeId, tenantId, {
            folderId: null, projectId,
          });
          if (!updated) throw new AppError(404, 'Program not found');
          return updated;
        }

        if (newParentId) await this.assertOwnedFolder(newParentId, tenantId);
        const updated = await projectsRepository.setProgramParent(nodeId, tenantId, {
          folderId: newParentId, projectId: null,
        });
        if (!updated) throw new AppError(404, 'Program not found');
        return updated;
      }

      case 'data_collection': {
        const owned = await recordsRepository.findCollection(nodeId, tenantId);
        if (!owned) throw new AppError(404, 'Data collection not found');
        if (newParentId) await this.assertOwnedFolder(newParentId, tenantId);
        const updated = await recordsRepository.updateCollection(nodeId, tenantId, { folder_id: newParentId });
        if (!updated) throw new AppError(404, 'Data collection not found');
        return updated;
      }
    }
  }

  // TREEAPI-02: capability-gated, transactional sibling reorder — dispatches
  // by node_type (and by project_id scope for programs) to the lock-safe
  // repository primitives built in 32-02. Emits exactly ONE batched durable
  // event per reorder (not one per sibling) — a documented exception to the
  // per-row archive-event convention, per RESEARCH.md Open Question 1.
  async reorderSiblings(ctx: RequestContext, body: unknown): Promise<ReorderNodesDto> {
    assertCapability(ctx, 'workspace.admin');
    const tenantId = requireCompanyId(ctx);
    const userId = requireUserId(ctx);
    const parsed = ReorderNodesSchema.safeParse(body);
    if (!parsed.success) throw new AppError(400, parsed.error.issues[0].message);

    const { node_type: nodeType, parent_id: parentId, project_id: projectId, ordered_ids: orderedIds } = parsed.data;

    const client = await db.connect();
    try {
      await client.query('BEGIN');

      switch (nodeType) {
        case 'folder':
          await foldersRepository.reorderFolders(client, tenantId, parentId, orderedIds);
          break;
        case 'project':
          await projectsRepository.reorderProjects(client, tenantId, parentId, orderedIds);
          break;
        case 'program':
          await projectsRepository.reorderPrograms(
            client, tenantId,
            projectId ? { folderId: null, projectId } : { folderId: parentId, projectId: null },
            orderedIds,
          );
          break;
        case 'data_collection':
          await recordsRepository.reorderCollections(client, tenantId, parentId, orderedIds);
          break;
      }

      await insertDurableEvent(client, createDurableEventEnvelope({
        eventName: `tree.${nodeType}.reordered`,
        tenantId,
        actorId: userId,
        objectType: nodeType,
        objectId: (nodeType === 'program' && projectId) ? projectId : (parentId ?? 'root'),
        correlationId: ctx.requestId,
        payloadVersion: 1,
        payload: { ordered_ids: orderedIds },
      }));

      await client.query('COMMIT');
      return { node_type: nodeType, parent_id: parentId, project_id: projectId ?? null, ordered_ids: orderedIds };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
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

  // Assembles the cross-entity tree from 5 already-fetched flat arrays via a
  // single pass over each array into a parent-keyed Map, then recursive
  // nesting from those maps — never a per-node .filter() over the full
  // array set (that would reintroduce fan-out cost in application memory).
  private assembleTree(
    folders: Folder[],
    projects: Project[],
    programs: Program[],
    pages: ProjectPage[],
    collections: DataCollectionRow[],
  ): TreeNode[] {
    const childrenByParent = new Map<string, TreeNode[]>();
    const addChild = (parentKey: string, node: TreeNode) => {
      const list = childrenByParent.get(parentKey);
      if (list) list.push(node);
      else childrenByParent.set(parentKey, [node]);
    };

    // Pages: nest under their parent page (recursive), or their project when root-level.
    const pageNodes = new Map<string, TreeNode>();
    for (const p of pages) {
      pageNodes.set(p.id, {
        node_type: 'project_page', id: p.id, company_id: p.company_id, name: p.title, children: [], raw: p,
      });
    }
    for (const p of pages) {
      const node = pageNodes.get(p.id)!;
      const parentKey = p.parent_page_id ? `page:${p.parent_page_id}` : `project:${p.project_id}`;
      addChild(parentKey, node);
    }
    for (const p of pages) {
      const node = pageNodes.get(p.id)!;
      node.children = childrenByParent.get(`page:${p.id}`) ?? [];
    }

    // Programs: project-scoped takes priority over folder-scoped, else root-level.
    for (const pr of programs) {
      const node: TreeNode = {
        node_type: 'program', id: pr.id, company_id: pr.company_id, name: pr.name, children: [], raw: pr,
      };
      const parentKey = pr.project_id ? `project:${pr.project_id}` : pr.folder_id ? `folder:${pr.folder_id}` : 'root';
      addChild(parentKey, node);
    }

    // Collections: project-scoped takes priority over folder-scoped, else root-level.
    for (const c of collections) {
      const node: TreeNode = {
        node_type: 'data_collection', id: c.id, company_id: c.company_id, name: c.name, children: [], raw: c,
      };
      const parentKey = c.project_id ? `project:${c.project_id}` : c.folder_id ? `folder:${c.folder_id}` : 'root';
      addChild(parentKey, node);
    }

    // Projects: nest under their folder, or top-level when root.
    const projectNodes = new Map<string, TreeNode>();
    for (const proj of projects) {
      projectNodes.set(proj.id, {
        node_type: 'project',
        id: proj.id,
        company_id: proj.company_id,
        name: proj.name,
        children: childrenByParent.get(`project:${proj.id}`) ?? [],
        raw: proj,
      });
    }
    for (const proj of projects) {
      const node = projectNodes.get(proj.id)!;
      const parentKey = proj.folder_id ? `folder:${proj.folder_id}` : 'root';
      addChild(parentKey, node);
    }

    // Folders: recursive nesting, same technique as buildTree but folded in with
    // the non-folder children collected above.
    const folderChildrenIds = new Map<string, Folder[]>();
    for (const f of folders) {
      const key = f.parent_id ?? 'root';
      const list = folderChildrenIds.get(key);
      if (list) list.push(f);
      else folderChildrenIds.set(key, [f]);
    }
    const buildFolderNode = (f: Folder): TreeNode => {
      const childFolders = (folderChildrenIds.get(f.id) ?? []).map(buildFolderNode);
      const nonFolderChildren = childrenByParent.get(`folder:${f.id}`) ?? [];
      return {
        node_type: 'folder',
        id: f.id,
        company_id: f.company_id,
        name: f.name,
        children: [...childFolders, ...nonFolderChildren],
        raw: f,
      };
    };

    const rootFolders = (folderChildrenIds.get('root') ?? []).map(buildFolderNode);
    const rootOthers = childrenByParent.get('root') ?? [];
    return [...rootFolders, ...rootOthers];
  }

  private async assertOwnedFolder(id: string, companyId: string): Promise<Folder> {
    const f = await foldersRepository.findFolderForCompany(id, companyId);
    if (!f) throw new AppError(404, 'Folder not found');
    return f;
  }
}

export const foldersService = new FoldersService();
