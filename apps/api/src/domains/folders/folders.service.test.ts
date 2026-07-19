import { test, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../../core/db';
import { AppError } from '../../core/errors/AppError';
import { RequestContext } from '../../core/auth/request-context';
import { foldersService } from './folders.service';
import { foldersRepository } from './folders.repository';
import { projectsRepository } from '../projects/projects.repository';
import { recordsRepository } from '../records/records.repository';
import * as outbox from '../../core/events/outbox';
import { Folder } from './folders.types';
import type { Project, Program, ProjectPage } from '../projects/projects.types';
import type { DataCollectionRow } from '../records/records.types';

afterEach(() => {
  mock.restoreAll();
});

function ctx(overrides: Partial<RequestContext> = {}): RequestContext {
  return {
    user: {
      id: 'user-1',
      role: 'admin',
      company_id: 'company-1',
      is_verified: true,
    },
    companyId: 'company-1',
    roles: ['admin'],
    workspaceId: 'company-1',
    requestId: 'request-1',
    deploymentMode: 'cloud',
    deploymentCapabilities: {
      mode: 'cloud',
      allowsLocalAiProxy: false,
      allowsSelfSignup: true,
      allowsExplicitFallbacks: true,
      requiresTrustedPublicEdges: true,
    },
    ...overrides,
  };
}

function folder(overrides: Partial<Folder> = {}): Folder {
  return {
    id: 'folder-1',
    company_id: 'company-1',
    parent_id: null,
    name: 'Folder',
    icon: null,
    color: null,
    sort_order: 0,
    created_by: 'user-1',
    created_at: new Date(),
    updated_at: new Date(),
    ancestor_ids: [],
    archived_at: null,
    ...overrides,
  };
}

test('getFolder uses the company-scoped repository helper', async () => {
  const findMock = mock.method(foldersRepository, 'findFolderForCompany', async () => folder());

  const found = await foldersService.getFolder(ctx(), 'folder-1');

  assert.equal(found.company_id, 'company-1');
  assert.deepEqual(findMock.mock.calls[0].arguments, ['folder-1', 'company-1']);
});

test('createFolder with a ctx lacking workspace.admin throws 403 before any repository call', async () => {
  const createMock = mock.method(foldersRepository, 'createFolder', async () => folder());

  await assert.rejects(
    foldersService.createFolder(ctx({ roles: ['member'] }), { name: 'New' }),
    (error: unknown) => error instanceof Error && (error as { status?: number }).status === 403,
  );
  assert.equal(createMock.mock.calls.length, 0);
});

const PARENT_ID = '11111111-1111-4111-8111-111111111111';
const FOLDER_ID = '22222222-2222-4222-8222-222222222222';
const ROOT_ID = '33333333-3333-4333-8333-333333333333';
const ANCESTOR_A = '44444444-4444-4444-8444-444444444444';
const ANCESTOR_B = '55555555-5555-4555-8555-555555555555';

test('createFolder with parent_id set computes ancestorIds from the parent and passes it to the repository', async () => {
  mock.method(foldersRepository, 'findFolderForCompany', async () => folder({
    id: PARENT_ID, ancestor_ids: [ROOT_ID],
  }));
  const createMock = mock.method(foldersRepository, 'createFolder', async () => folder({ id: 'child-1' }));

  await foldersService.createFolder(ctx(), { name: 'Child', parent_id: PARENT_ID });

  assert.deepEqual(createMock.mock.calls[0].arguments[3], [ROOT_ID, PARENT_ID]);
});

test('moveFolder rejects moving a folder into its own descendant without calling repository moveFolder', async () => {
  mock.method(foldersRepository, 'findFolderForCompany', async (id: string) => {
    if (id === FOLDER_ID) return folder({ id: FOLDER_ID, ancestor_ids: [] });
    if (id === PARENT_ID) return folder({ id: PARENT_ID, ancestor_ids: [FOLDER_ID] });
    return null;
  });
  const moveMock = mock.method(foldersRepository, 'moveFolder', async () => folder());

  await assert.rejects(
    foldersService.moveFolder(ctx(), FOLDER_ID, { parent_id: PARENT_ID }),
    (error: unknown) => error instanceof Error
      && (error as { status?: number }).status === 400
      && error.message === 'Cannot move a folder into its own descendant',
  );
  assert.equal(moveMock.mock.calls.length, 0);
});

test('moveFolder rejects when the resulting depth exceeds 3', async () => {
  mock.method(foldersRepository, 'findFolderForCompany', async (id: string) => {
    if (id === FOLDER_ID) return folder({ id: FOLDER_ID, ancestor_ids: [] });
    if (id === PARENT_ID) return folder({ id: PARENT_ID, ancestor_ids: [ANCESTOR_A, ANCESTOR_B] });
    return null;
  });
  const moveMock = mock.method(foldersRepository, 'moveFolder', async () => folder());

  await assert.rejects(
    foldersService.moveFolder(ctx(), FOLDER_ID, { parent_id: PARENT_ID }),
    (error: unknown) => error instanceof Error
      && (error as { status?: number }).status === 400
      && /depth/.test(error.message),
  );
  assert.equal(moveMock.mock.calls.length, 0);
});

test('listFolderTree and getFolder do not call assertCapability (reads stay capability-free)', async () => {
  mock.method(foldersRepository, 'listFolders', async () => []);
  mock.method(foldersRepository, 'findFolderForCompany', async () => folder());

  // A ctx with no roles at all would fail any assertCapability('workspace.admin') check.
  await foldersService.listFolderTree(ctx({ roles: [] }));
  await foldersService.getFolder(ctx({ roles: [] }), 'folder-1');
});

function project(overrides: Partial<Project> = {}): Project {
  return {
    id: 'project-1',
    company_id: 'company-1',
    name: 'Project',
    description: null,
    color: null,
    folder_id: FOLDER_ID,
    created_by: 'user-1',
    created_at: new Date(),
    updated_at: new Date(),
    archived_at: new Date(),
    ...overrides,
  };
}

function program(overrides: Partial<Program> = {}): Program {
  return {
    id: 'program-1',
    company_id: 'company-1',
    project_id: null,
    folder_id: FOLDER_ID,
    name: 'Program',
    description: null,
    type: 'transform',
    status: 'draft',
    config: {},
    created_by: 'user-1',
    created_at: new Date(),
    updated_at: new Date(),
    archived_at: new Date(),
    ...overrides,
  };
}

function page(overrides: Partial<ProjectPage> = {}): ProjectPage {
  return {
    id: 'page-1',
    company_id: 'company-1',
    project_id: 'project-1',
    parent_page_id: null,
    title: 'Page',
    icon: null,
    is_default: true,
    sort_order: 0,
    config: {},
    cover_image_url: null,
    header_settings: {},
    created_by: 'user-1',
    created_at: new Date(),
    updated_at: new Date(),
    archived_at: new Date(),
    ...overrides,
  };
}

function collectionRow(overrides: Partial<DataCollectionRow> = {}): DataCollectionRow {
  return {
    id: 'collection-1',
    company_id: 'company-1',
    project_id: null,
    folder_id: FOLDER_ID,
    name: 'Collection',
    schema: [],
    created_by: 'user-1',
    created_at: new Date(),
    updated_at: new Date(),
    archived_at: new Date(),
    ...overrides,
  };
}

function fakeClient() {
  return {
    query: mock.fn(async (_sql: string) => ({ rows: [] })),
    release: mock.fn(),
  };
}

test('archiveFolder archives the target folder plus every descendant folder in one transaction', async () => {
  mock.method(foldersRepository, 'findFolderForCompany', async () => folder({ id: FOLDER_ID }));
  mock.method(db, 'connect', async () => fakeClient());
  mock.method(foldersRepository, 'descendantFolderIds', async () => [FOLDER_ID, 'child-folder']);
  const archiveSubtreeMock = mock.method(foldersRepository, 'archiveFolderSubtree', async () => [
    folder({ id: FOLDER_ID }), folder({ id: 'child-folder' }),
  ]);
  mock.method(projectsRepository, 'archiveProjectsInFolders', async () => []);
  mock.method(projectsRepository, 'archiveProgramsInFolders', async () => []);
  mock.method(recordsRepository, 'archiveCollectionsInFolders', async () => []);
  mock.method(outbox, 'insertDurableEvent', async () => ({}) as never);

  await foldersService.archiveFolder(ctx(), FOLDER_ID);

  assert.equal(archiveSubtreeMock.mock.calls.length, 1);
  assert.deepEqual(archiveSubtreeMock.mock.calls[0].arguments[1], [FOLDER_ID, 'child-folder']);
});

test('archiving a folder that directly contains a project also archives that project\'s own programs/pages (pass 2)', async () => {
  mock.method(foldersRepository, 'findFolderForCompany', async () => folder({ id: FOLDER_ID }));
  mock.method(db, 'connect', async () => fakeClient());
  mock.method(foldersRepository, 'descendantFolderIds', async () => [FOLDER_ID]);
  mock.method(foldersRepository, 'archiveFolderSubtree', async () => [folder({ id: FOLDER_ID })]);
  mock.method(projectsRepository, 'archiveProjectsInFolders', async () => [project({ id: 'project-1' })]);
  mock.method(projectsRepository, 'archiveProgramsInFolders', async () => []);
  mock.method(recordsRepository, 'archiveCollectionsInFolders', async () => []);
  const programsViaProjectMock = mock.method(projectsRepository, 'archiveProgramsInProjects', async () => [program()]);
  const pagesMock = mock.method(projectsRepository, 'archivePagesInProjects', async () => [page()]);
  mock.method(recordsRepository, 'archiveCollectionsInProjects', async () => []);
  mock.method(outbox, 'insertDurableEvent', async () => ({}) as never);

  await foldersService.archiveFolder(ctx(), FOLDER_ID);

  assert.deepEqual(programsViaProjectMock.mock.calls[0].arguments[1], ['project-1']);
  assert.deepEqual(pagesMock.mock.calls[0].arguments[1], ['project-1']);
});

test('one insertDurableEvent call happens per archived row across all passes, never one batched event', async () => {
  mock.method(foldersRepository, 'findFolderForCompany', async () => folder({ id: FOLDER_ID }));
  mock.method(db, 'connect', async () => fakeClient());
  mock.method(foldersRepository, 'descendantFolderIds', async () => [FOLDER_ID]);
  mock.method(foldersRepository, 'archiveFolderSubtree', async () => [folder({ id: FOLDER_ID })]);
  mock.method(projectsRepository, 'archiveProjectsInFolders', async () => [project({ id: 'project-1' })]);
  mock.method(projectsRepository, 'archiveProgramsInFolders', async () => [program({ id: 'program-direct' })]);
  mock.method(recordsRepository, 'archiveCollectionsInFolders', async () => [collectionRow({ id: 'collection-direct' })]);
  mock.method(projectsRepository, 'archiveProgramsInProjects', async () => [program({ id: 'program-via-project' })]);
  mock.method(projectsRepository, 'archivePagesInProjects', async () => [page({ id: 'page-1' })]);
  mock.method(recordsRepository, 'archiveCollectionsInProjects', async () => [collectionRow({ id: 'collection-via-project' })]);

  const outboxSpy = mock.method(outbox, 'insertDurableEvent', async () => ({}) as never);

  await foldersService.archiveFolder(ctx(), FOLDER_ID);

  // 1 folder + 1 project + 1 program (direct) + 1 program (via project) + 1 page = 5.
  // Collections emit their own events inside the (mocked) repository methods, so
  // they are not counted here.
  assert.equal(outboxSpy.mock.calls.length, 5);
});

test('getFullTree calls each of the 5 repository methods exactly once and does not call assertCapability', async () => {
  const listFoldersMock = mock.method(foldersRepository, 'listFolders', async () => []);
  const listProjectsMock = mock.method(projectsRepository, 'listProjects', async () => []);
  const listProgramsMock = mock.method(projectsRepository, 'listPrograms', async () => []);
  const listAllPagesMock = mock.method(projectsRepository, 'listAllPages', async () => []);
  const listCollectionsMock = mock.method(recordsRepository, 'listCollections', async () => []);

  // A ctx with no roles at all would fail any assertCapability('workspace.admin') check.
  const tree = await foldersService.getFullTree(ctx({ roles: [] }));

  assert.deepEqual(tree, []);
  assert.equal(listFoldersMock.mock.calls.length, 1);
  assert.equal(listProjectsMock.mock.calls.length, 1);
  assert.equal(listProgramsMock.mock.calls.length, 1);
  assert.equal(listAllPagesMock.mock.calls.length, 1);
  assert.equal(listCollectionsMock.mock.calls.length, 1);
  // listPrograms must be called with no second (projectId) argument — ALL tenant programs.
  assert.equal(listProgramsMock.mock.calls[0].arguments.length, 1);
});

test('getFullTree nests a folder -> project -> program 3-level fixture correctly', async () => {
  mock.method(foldersRepository, 'listFolders', async () => [folder({ id: FOLDER_ID, parent_id: null })]);
  mock.method(projectsRepository, 'listProjects', async () => [project({ id: 'project-1', folder_id: FOLDER_ID })]);
  mock.method(projectsRepository, 'listPrograms', async () => [program({ id: 'program-1', folder_id: null, project_id: 'project-1' })]);
  mock.method(projectsRepository, 'listAllPages', async () => []);
  mock.method(recordsRepository, 'listCollections', async () => []);

  const tree = await foldersService.getFullTree(ctx());

  assert.equal(tree.length, 1);
  assert.equal(tree[0].node_type, 'folder');
  assert.equal(tree[0].id, FOLDER_ID);
  assert.equal(tree[0].children.length, 1);
  assert.equal(tree[0].children[0].node_type, 'project');
  assert.equal(tree[0].children[0].id, 'project-1');
  assert.equal(tree[0].children[0].children.length, 1);
  assert.equal(tree[0].children[0].children[0].node_type, 'program');
  assert.equal(tree[0].children[0].children[0].id, 'program-1');
});

test('getFullTree places a root-level project (folder_id: null) at the top level, not nested under any folder', async () => {
  mock.method(foldersRepository, 'listFolders', async () => [folder({ id: FOLDER_ID, parent_id: null })]);
  mock.method(projectsRepository, 'listProjects', async () => [project({ id: 'root-project', folder_id: null })]);
  mock.method(projectsRepository, 'listPrograms', async () => []);
  mock.method(projectsRepository, 'listAllPages', async () => []);
  mock.method(recordsRepository, 'listCollections', async () => []);

  const tree = await foldersService.getFullTree(ctx());

  assert.equal(tree.length, 2);
  const folderNode = tree.find((n) => n.node_type === 'folder')!;
  const rootProjectNode = tree.find((n) => n.node_type === 'project')!;
  assert.ok(folderNode);
  assert.ok(rootProjectNode);
  assert.equal(rootProjectNode.id, 'root-project');
  assert.equal(folderNode.children.length, 0);
});

test('getFullTree files a collection under a folder and a collection under a project into their correct parents', async () => {
  mock.method(foldersRepository, 'listFolders', async () => [folder({ id: FOLDER_ID, parent_id: null })]);
  mock.method(projectsRepository, 'listProjects', async () => [project({ id: 'project-1', folder_id: null })]);
  mock.method(projectsRepository, 'listPrograms', async () => []);
  mock.method(projectsRepository, 'listAllPages', async () => []);
  mock.method(recordsRepository, 'listCollections', async () => [
    collectionRow({ id: 'collection-in-folder', folder_id: FOLDER_ID, project_id: null }),
    collectionRow({ id: 'collection-in-project', folder_id: null, project_id: 'project-1' }),
  ]);

  const tree = await foldersService.getFullTree(ctx());

  const folderNode = tree.find((n) => n.node_type === 'folder')!;
  const projectNode = tree.find((n) => n.node_type === 'project')!;
  assert.equal(folderNode.children.length, 1);
  assert.equal(folderNode.children[0].node_type, 'data_collection');
  assert.equal(folderNode.children[0].id, 'collection-in-folder');
  assert.equal(projectNode.children.length, 1);
  assert.equal(projectNode.children[0].node_type, 'data_collection');
  assert.equal(projectNode.children[0].id, 'collection-in-project');
});

test('getFullTree returns an empty array for an empty tenant', async () => {
  mock.method(foldersRepository, 'listFolders', async () => []);
  mock.method(projectsRepository, 'listProjects', async () => []);
  mock.method(projectsRepository, 'listPrograms', async () => []);
  mock.method(projectsRepository, 'listAllPages', async () => []);
  mock.method(recordsRepository, 'listCollections', async () => []);

  const tree = await foldersService.getFullTree(ctx());

  assert.deepEqual(tree, []);
});

// ── reorderSiblings (TREEAPI-02) ────────────────────────────────────────────

const PROJECT_ID = '66666666-6666-4666-8666-666666666666';
const SIB_1 = '77777777-7777-4777-8777-777777777777';
const SIB_2 = '88888888-8888-4888-8888-888888888888';
const SIB_3 = '99999999-9999-4999-8999-999999999999';

test('reorderSiblings with a ctx lacking workspace.admin throws 403 before any repository call', async () => {
  const reorderFoldersMock = mock.method(foldersRepository, 'reorderFolders', async () => {});
  const connectMock = mock.method(db, 'connect', async () => fakeClient());

  await assert.rejects(
    foldersService.reorderSiblings(ctx({ roles: ['member'] }), {
      node_type: 'folder', parent_id: PARENT_ID, ordered_ids: [SIB_1, SIB_2],
    }),
    (error: unknown) => error instanceof Error && (error as { status?: number }).status === 403,
  );
  assert.equal(reorderFoldersMock.mock.calls.length, 0);
  assert.equal(connectMock.mock.calls.length, 0);
});

test('reorderSiblings rejects an empty ordered_ids array with 400 before db.connect() is called', async () => {
  const connectMock = mock.method(db, 'connect', async () => fakeClient());

  await assert.rejects(
    foldersService.reorderSiblings(ctx(), {
      node_type: 'project', parent_id: null, ordered_ids: [],
    }),
    (error: unknown) => error instanceof Error && (error as { status?: number }).status === 400,
  );
  assert.equal(connectMock.mock.calls.length, 0);
});

test('reorderSiblings dispatches folder reorder to foldersRepository.reorderFolders with tenantId, commits, and emits one batched event', async () => {
  const client = fakeClient();
  mock.method(db, 'connect', async () => client);
  const reorderFoldersMock = mock.method(foldersRepository, 'reorderFolders', async () => {});
  const outboxSpy = mock.method(outbox, 'insertDurableEvent', async () => ({}) as never);

  const result = await foldersService.reorderSiblings(ctx(), {
    node_type: 'folder', parent_id: PARENT_ID, ordered_ids: [SIB_1, SIB_2, SIB_3],
  });

  assert.equal(reorderFoldersMock.mock.calls.length, 1);
  assert.deepEqual(reorderFoldersMock.mock.calls[0].arguments.slice(1), ['company-1', PARENT_ID, [SIB_1, SIB_2, SIB_3]]);
  assert.equal(outboxSpy.mock.calls.length, 1);
  const event = outboxSpy.mock.calls[0]!.arguments[1] as { eventName: string };
  assert.match(event.eventName, /^tree\..+\.reordered$/);
  assert.deepEqual(result, { node_type: 'folder', parent_id: PARENT_ID, project_id: null, ordered_ids: [SIB_1, SIB_2, SIB_3] });
});

test('reorderSiblings dispatches project reorder to projectsRepository.reorderProjects with tenantId', async () => {
  mock.method(db, 'connect', async () => fakeClient());
  const reorderProjectsMock = mock.method(projectsRepository, 'reorderProjects', async () => {});
  mock.method(outbox, 'insertDurableEvent', async () => ({}) as never);

  await foldersService.reorderSiblings(ctx(), {
    node_type: 'project', parent_id: PARENT_ID, ordered_ids: [SIB_1, SIB_2],
  });

  assert.equal(reorderProjectsMock.mock.calls.length, 1);
  assert.deepEqual(reorderProjectsMock.mock.calls[0].arguments.slice(1), ['company-1', PARENT_ID, [SIB_1, SIB_2]]);
});

test('reorderSiblings dispatches data_collection reorder to recordsRepository.reorderCollections with tenantId', async () => {
  mock.method(db, 'connect', async () => fakeClient());
  const reorderCollectionsMock = mock.method(recordsRepository, 'reorderCollections', async () => {});
  mock.method(outbox, 'insertDurableEvent', async () => ({}) as never);

  await foldersService.reorderSiblings(ctx(), {
    node_type: 'data_collection', parent_id: PARENT_ID, ordered_ids: [SIB_1, SIB_2],
  });

  assert.equal(reorderCollectionsMock.mock.calls.length, 1);
  assert.deepEqual(reorderCollectionsMock.mock.calls[0].arguments.slice(1), ['company-1', PARENT_ID, [SIB_1, SIB_2]]);
});

test('reorderSiblings dispatches program reorder with project_id set to reorderPrograms with { folderId: null, projectId }', async () => {
  mock.method(db, 'connect', async () => fakeClient());
  const reorderProgramsMock = mock.method(projectsRepository, 'reorderPrograms', async () => {});
  mock.method(outbox, 'insertDurableEvent', async () => ({}) as never);

  const result = await foldersService.reorderSiblings(ctx(), {
    node_type: 'program', parent_id: null, project_id: PROJECT_ID, ordered_ids: [SIB_1, SIB_2],
  });

  assert.equal(reorderProgramsMock.mock.calls.length, 1);
  assert.deepEqual(reorderProgramsMock.mock.calls[0].arguments.slice(1), [
    'company-1', { folderId: null, projectId: PROJECT_ID }, [SIB_1, SIB_2],
  ]);
  assert.equal(result.project_id, PROJECT_ID);
});

test('reorderSiblings dispatches program reorder with project_id omitted to reorderPrograms with { folderId: parent_id, projectId: null }', async () => {
  mock.method(db, 'connect', async () => fakeClient());
  const reorderProgramsMock = mock.method(projectsRepository, 'reorderPrograms', async () => {});
  mock.method(outbox, 'insertDurableEvent', async () => ({}) as never);

  const result = await foldersService.reorderSiblings(ctx(), {
    node_type: 'program', parent_id: PARENT_ID, ordered_ids: [SIB_1, SIB_2],
  });

  assert.equal(reorderProgramsMock.mock.calls.length, 1);
  assert.deepEqual(reorderProgramsMock.mock.calls[0].arguments.slice(1), [
    'company-1', { folderId: PARENT_ID, projectId: null }, [SIB_1, SIB_2],
  ]);
  assert.equal(result.project_id, null);
});

test('reorderSiblings rolls back the transaction and propagates a repository 409 conflict', async () => {
  const client = fakeClient();
  mock.method(db, 'connect', async () => client);
  mock.method(foldersRepository, 'reorderFolders', async () => {
    throw new AppError(409, 'Sibling set has changed since last read — refresh and retry');
  });

  await assert.rejects(
    foldersService.reorderSiblings(ctx(), {
      node_type: 'folder', parent_id: PARENT_ID, ordered_ids: [SIB_1, SIB_2],
    }),
    (error: unknown) => error instanceof Error && (error as { status?: number }).status === 409,
  );

  const queryCalls = client.query.mock.calls.map((c) => c.arguments[0]);
  assert.equal(queryCalls[queryCalls.length - 1], 'ROLLBACK');
});

// ── moveNode (TREEAPI-03) ────────────────────────────────────────────────

test('moveNode with a ctx lacking workspace.admin throws 403 before any repository call', async () => {
  const findProjectMock = mock.method(projectsRepository, 'findProjectForCompany', async () => project());

  await assert.rejects(
    foldersService.moveNode(ctx({ roles: ['member'] }), {
      node_type: 'project', node_id: 'project-1', new_parent_id: FOLDER_ID,
    }),
    (error: unknown) => error instanceof Error && (error as { status?: number }).status === 403,
  );
  assert.equal(findProjectMock.mock.calls.length, 0);
});

test("moveNode dispatches node_type 'folder' by delegating verbatim to moveFolder (no duplicate cycle-check)", async () => {
  mock.method(foldersRepository, 'findFolderForCompany', async (id: string) => {
    if (id === FOLDER_ID) return folder({ id: FOLDER_ID, ancestor_ids: [] });
    if (id === PARENT_ID) return folder({ id: PARENT_ID, ancestor_ids: [] });
    return null;
  });
  const moveFolderRepoMock = mock.method(foldersRepository, 'moveFolder', async () => folder({ id: FOLDER_ID, parent_id: PARENT_ID }));
  mock.method(foldersRepository, 'descendantFolderIds', async () => [FOLDER_ID]);

  const result = await foldersService.moveNode(ctx(), {
    node_type: 'folder', node_id: FOLDER_ID, new_parent_id: PARENT_ID,
  });

  assert.equal(moveFolderRepoMock.mock.calls.length, 1);
  assert.equal((result as Folder).id, FOLDER_ID);
});

test("moveNode dispatches node_type 'folder' into its own descendant and inherits moveFolder's existing 400 (no separate reimplementation)", async () => {
  mock.method(foldersRepository, 'findFolderForCompany', async (id: string) => {
    if (id === FOLDER_ID) return folder({ id: FOLDER_ID, ancestor_ids: [] });
    if (id === PARENT_ID) return folder({ id: PARENT_ID, ancestor_ids: [FOLDER_ID] });
    return null;
  });
  const moveFolderRepoMock = mock.method(foldersRepository, 'moveFolder', async () => folder());

  await assert.rejects(
    foldersService.moveNode(ctx(), { node_type: 'folder', node_id: FOLDER_ID, new_parent_id: PARENT_ID }),
    (error: unknown) => error instanceof Error
      && (error as { status?: number }).status === 400
      && error.message === 'Cannot move a folder into its own descendant',
  );
  assert.equal(moveFolderRepoMock.mock.calls.length, 0);
});

test("moveNode('project') moving into a cross-tenant folder destination throws 404", async () => {
  mock.method(projectsRepository, 'findProjectForCompany', async () => project({ id: 'project-1' }));
  mock.method(foldersRepository, 'findFolderForCompany', async () => null);
  const updateMock = mock.method(projectsRepository, 'setProjectFolder', async () => project());

  await assert.rejects(
    foldersService.moveNode(ctx(), { node_type: 'project', node_id: 'project-1', new_parent_id: FOLDER_ID }),
    (error: unknown) => error instanceof Error && (error as { status?: number }).status === 404,
  );
  assert.equal(updateMock.mock.calls.length, 0);
});

test("moveNode('project') whose node_id doesn't belong to the caller's tenant throws 404 before any destination check", async () => {
  const findProjectMock = mock.method(projectsRepository, 'findProjectForCompany', async () => null);
  const findFolderMock = mock.method(foldersRepository, 'findFolderForCompany', async () => folder());

  await assert.rejects(
    foldersService.moveNode(ctx(), { node_type: 'project', node_id: 'missing-project', new_parent_id: FOLDER_ID }),
    (error: unknown) => error instanceof Error && (error as { status?: number }).status === 404,
  );
  assert.equal(findProjectMock.mock.calls.length, 1);
  assert.equal(findFolderMock.mock.calls.length, 0);
});

test("moveNode('project') into an owned folder calls setProjectFolder with the new folder_id", async () => {
  mock.method(projectsRepository, 'findProjectForCompany', async () => project({ id: 'project-1' }));
  mock.method(foldersRepository, 'findFolderForCompany', async () => folder({ id: PARENT_ID }));
  const updateMock = mock.method(projectsRepository, 'setProjectFolder', async () => project({ id: 'project-1', folder_id: PARENT_ID }));

  await foldersService.moveNode(ctx(), { node_type: 'project', node_id: 'project-1', new_parent_id: PARENT_ID });

  assert.deepEqual(updateMock.mock.calls[0].arguments, ['project-1', 'company-1', PARENT_ID]);
});

test("moveNode('data_collection') with node_id missing from the tenant throws 404 when the ownership pre-check returns null", async () => {
  const findMock = mock.method(recordsRepository, 'findCollection', async () => null);

  await assert.rejects(
    foldersService.moveNode(ctx(), { node_type: 'data_collection', node_id: 'missing-collection', new_parent_id: null }),
    (error: unknown) => error instanceof Error && (error as { status?: number }).status === 404,
  );
  assert.equal(findMock.mock.calls.length, 1);
});

test("moveNode('data_collection') with new_parent_id: null un-files it via updateCollection folder_id: null", async () => {
  mock.method(recordsRepository, 'findCollection', async () => collectionRow({ id: 'collection-1' }));
  const updateMock = mock.method(recordsRepository, 'updateCollection', async () => collectionRow({ id: 'collection-1', folder_id: null }));

  await foldersService.moveNode(ctx(), { node_type: 'data_collection', node_id: 'collection-1', new_parent_id: null });

  assert.deepEqual(updateMock.mock.calls[0].arguments, ['collection-1', 'company-1', { folder_id: null }]);
});

test("moveNode('program') with project_id set to a cross-tenant project throws 404 (project-scoped destination ownership enforced)", async () => {
  mock.method(projectsRepository, 'findProgramForCompany', async () => program({ id: 'program-1' }));
  mock.method(projectsRepository, 'findProjectForCompany', async () => null);
  const updateMock = mock.method(projectsRepository, 'setProgramParent', async () => program());

  await assert.rejects(
    foldersService.moveNode(ctx(), {
      node_type: 'program', node_id: 'program-1', new_parent_id: null, project_id: PROJECT_ID,
    }),
    (error: unknown) => error instanceof Error && (error as { status?: number }).status === 404,
  );
  assert.equal(updateMock.mock.calls.length, 0);
});

test("moveNode('program') with project_id set to an owned project calls setProgramParent with { projectId, folderId: null }", async () => {
  mock.method(projectsRepository, 'findProgramForCompany', async () => program({ id: 'program-1' }));
  mock.method(projectsRepository, 'findProjectForCompany', async () => project({ id: PROJECT_ID }));
  const updateMock = mock.method(projectsRepository, 'setProgramParent', async () => program({ id: 'program-1', project_id: PROJECT_ID, folder_id: null }));

  await foldersService.moveNode(ctx(), {
    node_type: 'program', node_id: 'program-1', new_parent_id: null, project_id: PROJECT_ID,
  });

  assert.deepEqual(updateMock.mock.calls[0].arguments, ['program-1', 'company-1', { folderId: null, projectId: PROJECT_ID }]);
});

test("moveNode('program') with project_id omitted falls back to folder-scoped move, calling setProgramParent with { folderId, projectId: null }", async () => {
  mock.method(projectsRepository, 'findProgramForCompany', async () => program({ id: 'program-1' }));
  mock.method(foldersRepository, 'findFolderForCompany', async () => folder({ id: PARENT_ID }));
  const updateMock = mock.method(projectsRepository, 'setProgramParent', async () => program({ id: 'program-1', folder_id: PARENT_ID, project_id: null }));

  await foldersService.moveNode(ctx(), {
    node_type: 'program', node_id: 'program-1', new_parent_id: PARENT_ID,
  });

  assert.deepEqual(updateMock.mock.calls[0].arguments, ['program-1', 'company-1', { folderId: PARENT_ID, projectId: null }]);
});

test('unarchiveFolder restores the folder only (no cascade) and emits a folder.unarchived event', async () => {
  mock.method(foldersRepository, 'unarchiveFolder', async () => folder({ id: FOLDER_ID }));
  mock.method(db, 'connect', async () => fakeClient());
  const projectsCascadeMock = mock.method(projectsRepository, 'archiveProjectsInFolders', async () => []);
  const outboxSpy = mock.method(outbox, 'insertDurableEvent', async () => ({}) as never);

  await foldersService.unarchiveFolder(ctx(), FOLDER_ID);

  assert.equal(projectsCascadeMock.mock.calls.length, 0);
  assert.equal(outboxSpy.mock.calls.length, 1);
  const event = outboxSpy.mock.calls[0]!.arguments[1] as { eventName: string };
  assert.equal(event.eventName, 'folder.unarchived');
});
