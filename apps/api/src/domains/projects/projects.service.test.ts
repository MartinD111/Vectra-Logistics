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
