import { test, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../../core/db';
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
    query: async (_sql: string) => ({ rows: [] }),
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
