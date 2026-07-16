import { test, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { RequestContext } from '../../core/auth/request-context';
import { foldersService } from './folders.service';
import { foldersRepository } from './folders.repository';
import { Folder } from './folders.types';

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
