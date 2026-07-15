import { test, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { foldersService } from './folders.service';
import { foldersRepository } from './folders.repository';

afterEach(() => {
  mock.restoreAll();
});

test('getFolder uses the company-scoped repository helper', async () => {
  const findMock = mock.method(foldersRepository, 'findFolderForCompany', async () => ({
    id: 'folder-1',
    company_id: 'company-1',
    parent_id: null,
    name: 'Folder',
    icon: null,
    color: null,
    sort_order: 0,
    created_by: null,
    created_at: new Date(),
    updated_at: new Date(),
  }));

  const folder = await foldersService.getFolder('folder-1', 'company-1');

  assert.equal(folder.company_id, 'company-1');
  assert.deepEqual(findMock.mock.calls[0].arguments, ['folder-1', 'company-1']);
});
