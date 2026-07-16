import { test, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { projectsService } from './projects.service';
import { projectsRepository } from './projects.repository';

afterEach(() => {
  mock.restoreAll();
});

test('getProject fails closed when the scoped repository lookup misses', async () => {
  const findMock = mock.method(projectsRepository, 'findProjectForCompany', async () => null);

  await assert.rejects(
    projectsService.getProject('project-1', 'company-1'),
    (error: unknown) => error instanceof Error && (error as { status?: number }).status === 404,
  );
  assert.equal(findMock.mock.calls.length, 1);
  assert.deepEqual(findMock.mock.calls[0].arguments, ['project-1', 'company-1']);
});

test('getProgram and getPage use company-scoped repository helpers', async () => {
  mock.method(projectsRepository, 'findProgramForCompany', async () => ({
    id: 'program-1',
    company_id: 'company-1',
    project_id: null,
    folder_id: null,
    name: 'Program',
    description: null,
    type: 'transform',
    status: 'draft',
    config: {},
    created_by: null,
    created_at: new Date(),
    updated_at: new Date(),
  }));
  mock.method(projectsRepository, 'findPageForCompany', async () => ({
    id: 'page-1',
    company_id: 'company-1',
    project_id: 'project-1',
    parent_page_id: null,
    title: 'Page',
    icon: null,
    is_default: false,
    sort_order: 0,
    config: {},
    cover_image_url: null,
    header_settings: {},
    created_by: null,
    created_at: new Date(),
    updated_at: new Date(),
  }));

  const program = await projectsService.getProgram('program-1', 'company-1');
  const page = await projectsService.getPage('page-1', 'company-1');

  assert.equal(program.company_id, 'company-1');
  assert.equal(page.company_id, 'company-1');
});

const baseProject = {
  id: 'project-1',
  company_id: 'company-1',
  name: 'Project',
  description: null,
  color: null,
  folder_id: null,
  created_by: null,
  created_at: new Date(),
  updated_at: new Date(),
  archived_at: null as Date | null,
};

const baseProgram = {
  id: 'program-1',
  company_id: 'company-1',
  project_id: null as string | null,
  folder_id: null,
  name: 'Program',
  description: null,
  type: 'transform',
  status: 'draft',
  config: {},
  created_by: null,
  created_at: new Date(),
  updated_at: new Date(),
  archived_at: null as Date | null,
};

test('archiveProject sets archived_at and emits project.archived', async () => {
  mock.method(projectsRepository, 'findProject', async () => ({ ...baseProject }));
  const archiveMock = mock.method(projectsRepository, 'archiveProject', async () => ({
    ...baseProject, archived_at: new Date(),
  }));

  const result = await projectsService.archiveProject('project-1', 'company-1', 'user-1');

  assert.equal(archiveMock.mock.calls.length, 1);
  assert.ok(result.archived_at);
});

test('archiveProject on a different company project throws 404', async () => {
  mock.method(projectsRepository, 'findProject', async () => ({ ...baseProject, company_id: 'other-company' }));

  await assert.rejects(
    projectsService.archiveProject('project-1', 'company-1', 'user-1'),
    (error: unknown) => error instanceof Error && (error as { status?: number }).status === 404,
  );
});

test('unarchiveProject clears archived_at and emits project.unarchived', async () => {
  mock.method(projectsRepository, 'findProject', async () => ({ ...baseProject, archived_at: new Date() }));
  const unarchiveMock = mock.method(projectsRepository, 'unarchiveProject', async () => ({
    ...baseProject, archived_at: null,
  }));

  const result = await projectsService.unarchiveProject('project-1', 'company-1', 'user-1');

  assert.equal(unarchiveMock.mock.calls.length, 1);
  assert.equal(result.archived_at, null);
});

test('archiveProgram sets archived_at and emits program.archived', async () => {
  mock.method(projectsRepository, 'findProgram', async () => ({ ...baseProgram }));
  const archiveMock = mock.method(projectsRepository, 'archiveProgram', async () => ({
    ...baseProgram, archived_at: new Date(),
  }));

  const result = await projectsService.archiveProgram('program-1', 'company-1', 'user-1');

  assert.equal(archiveMock.mock.calls.length, 1);
  assert.ok(result.archived_at);
});

test('archiveProgram on a different company program throws 404', async () => {
  mock.method(projectsRepository, 'findProgram', async () => ({ ...baseProgram, company_id: 'other-company' }));

  await assert.rejects(
    projectsService.archiveProgram('program-1', 'company-1', 'user-1'),
    (error: unknown) => error instanceof Error && (error as { status?: number }).status === 404,
  );
});

test('unarchiveProgram clears archived_at and emits program.unarchived', async () => {
  mock.method(projectsRepository, 'findProgram', async () => ({ ...baseProgram, archived_at: new Date() }));
  const unarchiveMock = mock.method(projectsRepository, 'unarchiveProgram', async () => ({
    ...baseProgram, archived_at: null,
  }));

  const result = await projectsService.unarchiveProgram('program-1', 'company-1', 'user-1');

  assert.equal(unarchiveMock.mock.calls.length, 1);
  assert.equal(result.archived_at, null);
});
