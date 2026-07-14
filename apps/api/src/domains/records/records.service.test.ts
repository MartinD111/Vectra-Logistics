import { test, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { recordsService } from './records.service';
import { recordsRepository } from './records.repository';
import { DataCollectionRow, CollectionRecordRow, CollectionViewRow } from './records.types';

const COLLECTION_ID = '11111111-1111-4111-8111-111111111111';

function makeCollection(overrides: Partial<DataCollectionRow> = {}): DataCollectionRow {
  return {
    id: COLLECTION_ID, company_id: 'company-1', project_id: null, name: 'Clients',
    schema: [{ id: 'age', name: 'Age', type: 'number' }],
    created_by: null, created_at: new Date(), updated_at: new Date(),
    ...overrides,
  };
}

function makeRecord(overrides: Partial<CollectionRecordRow> = {}): CollectionRecordRow {
  return {
    id: 'record-1', company_id: 'company-1', collection_id: COLLECTION_ID, parent_record_id: null,
    props: {}, body: { version: 1, blocks: [] }, sort_order: 0,
    created_by: null, created_at: new Date(), updated_at: new Date(),
    ...overrides,
  };
}

function makeView(overrides: Partial<CollectionViewRow> = {}): CollectionViewRow {
  return {
    id: 'view-1', company_id: 'company-1', collection_id: COLLECTION_ID, name: 'Table',
    type: 'table', config: {}, sort_order: 0, created_at: new Date(),
    ...overrides,
  };
}

afterEach(() => {
  mock.restoreAll();
});

// REC-01/D-03: createCollection delegates to the single atomic repo call.
test('createCollection calls createCollectionWithDefaultView exactly once and returns its result unchanged', async () => {
  const fakeCollection = makeCollection();
  const fakeView = makeView();
  const createMock = mock.method(
    recordsRepository, 'createCollectionWithDefaultView',
    async () => ({ collection: fakeCollection, view: fakeView }),
  );

  const result = await recordsService.createCollection('company-1', { name: 'Clients', schema: fakeCollection.schema });

  assert.equal(createMock.mock.calls.length, 1);
  assert.deepEqual(result, { collection: fakeCollection, view: fakeView });
});

// D-02: reject a prop id that isn't declared in the collection's schema.
test('createRecord rejects a prop id that is not in the collection schema', async () => {
  mock.method(recordsRepository, 'findCollection', async () => makeCollection());
  const createRecordMock = mock.method(recordsRepository, 'createRecord', async () => makeRecord());

  await assert.rejects(
    recordsService.createRecord('company-1', { collection_id: COLLECTION_ID, props: { notInSchema: 'x' } }),
    (err: unknown) => err instanceof Error && (err as { status?: number }).status === 400,
  );
  assert.equal(createRecordMock.mock.calls.length, 0);
});

// D-02: reject a prop value whose type doesn't match the schema-declared type.
test('createRecord rejects a prop value with a type mismatch', async () => {
  mock.method(recordsRepository, 'findCollection', async () => makeCollection({
    schema: [{ id: 'age', name: 'Age', type: 'number' }],
  }));
  const createRecordMock = mock.method(recordsRepository, 'createRecord', async () => makeRecord());

  await assert.rejects(
    recordsService.createRecord('company-1', { collection_id: COLLECTION_ID, props: { age: 'not-a-number' } }),
    (err: unknown) => err instanceof Error && (err as { status?: number }).status === 400,
  );
  assert.equal(createRecordMock.mock.calls.length, 0);
});

// D-02: accept a valid prop value matching the schema-declared type.
test('createRecord accepts a valid prop value and calls the repository once', async () => {
  mock.method(recordsRepository, 'findCollection', async () => makeCollection({
    schema: [{ id: 'age', name: 'Age', type: 'number' }],
  }));
  const fakeRecord = makeRecord({ props: { age: 42 } });
  const createRecordMock = mock.method(recordsRepository, 'createRecord', async () => fakeRecord);

  const result = await recordsService.createRecord('company-1', { collection_id: COLLECTION_ID, props: { age: 42 } });

  assert.deepEqual(result, fakeRecord);
  assert.equal(createRecordMock.mock.calls.length, 1);
});

// REC-02: body envelope passes through to the repository unchanged, no block-kind filtering.
test('createRecord passes the body envelope through to the repository unchanged', async () => {
  mock.method(recordsRepository, 'findCollection', async () => makeCollection({ schema: [] }));
  const fakeBody = { version: 1, blocks: [{ kind: 'paragraph' }] };
  const createRecordMock = mock.method(recordsRepository, 'createRecord', async (companyId: string, d: { body?: unknown }) => makeRecord({ body: d.body as Record<string, unknown> }));

  await recordsService.createRecord('company-1', { collection_id: COLLECTION_ID, body: fakeBody });

  assert.equal(createRecordMock.mock.calls.length, 1);
  const callArgs = createRecordMock.mock.calls[0].arguments[1] as { body: unknown };
  assert.deepEqual(callArgs.body, fakeBody);
});

// REC-03: view config round-trips unchanged through the service layer.
test('createView round-trips config unchanged', async () => {
  mock.method(recordsRepository, 'findCollection', async () => makeCollection());
  const fakeConfig = { groupBy: 'status', filters: [], sorts: [], cardProperties: ['name'] };
  const fakeView = makeView({ config: fakeConfig });
  mock.method(recordsRepository, 'createView', async () => fakeView);

  const result = await recordsService.createView('company-1', COLLECTION_ID, { name: 'Board', type: 'board', config: fakeConfig });

  assert.deepEqual(result.config, fakeConfig);
});

// Pitfall 2 (404-before-400): missing collection short-circuits before prop validation runs.
test('createRecord throws 404 before running prop validation when the collection is missing', async () => {
  mock.method(recordsRepository, 'findCollection', async () => null);
  const createRecordMock = mock.method(recordsRepository, 'createRecord', async () => makeRecord());

  await assert.rejects(
    recordsService.createRecord('company-1', { collection_id: '11111111-1111-4111-8111-111111111111', props: { notInSchema: 'x' } }),
    (err: unknown) => {
      assert.ok(err instanceof Error);
      assert.equal((err as { status?: number }).status, 404);
      assert.match(err.message, /not found/i);
      return true;
    },
  );
  assert.equal(createRecordMock.mock.calls.length, 0);
});
