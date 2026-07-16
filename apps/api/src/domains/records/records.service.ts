import { AppError } from '../../core/errors/AppError';
import { RequestContext } from '../../core/auth/request-context';
import { recordsRepository } from './records.repository';
import { foldersRepository } from '../folders/folders.repository';
import { CollectionPropertyDef, DataCollectionRow, CollectionRecordRow, CollectionViewRow } from './records.types';
import { CreateCollectionSchema } from './dto/create-collection.dto';
import { UpdateCollectionSchema } from './dto/update-collection.dto';
import { CreateRecordSchema } from './dto/create-record.dto';
import { UpdateRecordSchema } from './dto/update-record.dto';
import { CreateViewSchema } from './dto/create-view.dto';
import { UpdateViewSchema } from './dto/update-view.dto';

class RecordsService {
  // ── Collections ──
  async createCollection(
    companyId: string,
    body: unknown,
    context?: RequestContext,
  ): Promise<{ collection: DataCollectionRow; view: CollectionViewRow }> {
    const parsed = CreateCollectionSchema.safeParse(body);
    if (!parsed.success) throw new AppError(400, parsed.error.issues[0].message);
    if (parsed.data.folder_id) await this.assertOwnedFolder(parsed.data.folder_id, companyId);
    // D-03: one atomic repo call creates the collection AND its default
    // 'table' view — never two separate service-level calls.
    return recordsRepository.createCollectionWithDefaultView(companyId, {
      name: parsed.data.name,
      schema: (parsed.data.schema ?? []) as CollectionPropertyDef[],
      folderId: parsed.data.folder_id,
      createdBy: context?.user?.id ?? null,
      actorId: context?.user?.id ?? null,
      correlationId: context?.requestId ?? null,
    });
  }

  async getCollection(id: string, companyId: string): Promise<DataCollectionRow> {
    const collection = await recordsRepository.findCollection(id, companyId);
    if (!collection) throw new AppError(404, 'Collection not found');
    return collection;
  }

  listCollections(companyId: string): Promise<DataCollectionRow[]> {
    return recordsRepository.listCollections(companyId);
  }

  async updateCollection(id: string, companyId: string, body: unknown): Promise<DataCollectionRow> {
    const parsed = UpdateCollectionSchema.safeParse(body);
    if (!parsed.success) throw new AppError(400, parsed.error.issues[0].message);
    await this.getCollection(id, companyId);
    if (parsed.data.folder_id) await this.assertOwnedFolder(parsed.data.folder_id, companyId);
    const updated = await recordsRepository.updateCollection(id, companyId, {
      name: parsed.data.name,
      schema: parsed.data.schema as CollectionPropertyDef[] | undefined,
      folder_id: parsed.data.folder_id,
    });
    if (!updated) throw new AppError(404, 'Collection not found');
    return updated;
  }

  // ── Records ──
  async createRecord(companyId: string, body: unknown): Promise<CollectionRecordRow> {
    const parsed = CreateRecordSchema.safeParse(body);
    if (!parsed.success) throw new AppError(400, parsed.error.issues[0].message);
    // Pitfall 2 ordering: 404 (collection ownership) before any prop validation.
    const collection = await this.getCollection(parsed.data.collection_id, companyId);
    this.validateProps(collection.schema, parsed.data.props ?? {});
    return recordsRepository.createRecord(companyId, {
      collectionId: parsed.data.collection_id,
      parentRecordId: parsed.data.parent_record_id ?? null,
      props: parsed.data.props ?? {},
      body: parsed.data.body ?? { version: 1, blocks: [] },
      createdBy: null,
    });
  }

  async getRecord(id: string, companyId: string): Promise<CollectionRecordRow> {
    const record = await recordsRepository.findRecord(id, companyId);
    if (!record) throw new AppError(404, 'Record not found');
    return record;
  }

  listRecords(collectionId: string, companyId: string): Promise<CollectionRecordRow[]> {
    return recordsRepository.listRecords(collectionId, companyId);
  }

  listRecordChildren(parentRecordId: string, companyId: string): Promise<CollectionRecordRow[]> {
    return recordsRepository.listChildren(parentRecordId, companyId);
  }

  async updateRecord(id: string, companyId: string, body: unknown): Promise<CollectionRecordRow> {
    const parsed = UpdateRecordSchema.safeParse(body);
    if (!parsed.success) throw new AppError(400, parsed.error.issues[0].message);
    const record = await this.getRecord(id, companyId);

    if (parsed.data.props !== undefined) {
      const collection = await this.getCollection(record.collection_id, companyId);
      this.validateProps(collection.schema, parsed.data.props);
    }

    const updated = await recordsRepository.updateRecord(id, companyId, {
      props: parsed.data.props,
      body: parsed.data.body,
      parent_record_id: parsed.data.parent_record_id,
      sort_order: parsed.data.sort_order,
    });
    if (!updated) throw new AppError(404, 'Record not found');
    return updated;
  }

  // ── Views ──
  async createView(companyId: string, collectionId: string, body: unknown): Promise<CollectionViewRow> {
    const parsed = CreateViewSchema.safeParse(body);
    if (!parsed.success) throw new AppError(400, parsed.error.issues[0].message);
    await this.getCollection(collectionId, companyId);
    // REC-03: config passed through unmodified — no field renaming/defaulting
    // beyond what the DTO already applies.
    return recordsRepository.createView(companyId, {
      collectionId,
      name: parsed.data.name,
      type: parsed.data.type,
      config: parsed.data.config ?? {},
    });
  }

  async getView(id: string, companyId: string): Promise<CollectionViewRow> {
    const view = await recordsRepository.findView(id, companyId);
    if (!view) throw new AppError(404, 'View not found');
    return view;
  }

  listViews(collectionId: string, companyId: string): Promise<CollectionViewRow[]> {
    return recordsRepository.listViews(collectionId, companyId);
  }

  async updateView(id: string, companyId: string, body: unknown): Promise<CollectionViewRow> {
    const parsed = UpdateViewSchema.safeParse(body);
    if (!parsed.success) throw new AppError(400, parsed.error.issues[0].message);
    await this.getView(id, companyId);
    const updated = await recordsRepository.updateView(id, companyId, {
      name: parsed.data.name,
      type: parsed.data.type,
      config: parsed.data.config,
    });
    if (!updated) throw new AppError(404, 'View not found');
    return updated;
  }

  // ── D-02: dynamic prop-type validation against the collection's declared schema ──
  private validateProps(schema: CollectionPropertyDef[], props: Record<string, unknown>): void {
    for (const key of Object.keys(props)) {
      const entry = schema.find((s) => s.id === key);
      if (!entry) throw new AppError(400, `Unknown property: ${key}`);
      if (!this.validatePropValue(entry.type, props[key])) {
        throw new AppError(400, `${entry.name} must be a valid ${entry.type}`);
      }
    }
  }

  private validatePropValue(type: CollectionPropertyDef['type'], value: unknown): boolean {
    switch (type) {
      case 'text':
      case 'url':
      case 'email':
      case 'phone':
      case 'select':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number';
      case 'checkbox':
        return typeof value === 'boolean';
      case 'date':
        return typeof value === 'string';
      case 'multi-select':
      case 'files':
      case 'relation':
        return Array.isArray(value) && value.every((v) => typeof v === 'string');
      case 'person':
        return typeof value === 'string';
      default:
        return true;
    }
  }

  // T-31-04: reject a cross-tenant/missing folder_id before any write.
  // findFolderForCompany returns null for both "no such folder" and
  // "wrong tenant", so a plain 404 is correct with no existence leak.
  private async assertOwnedFolder(id: string, companyId: string): Promise<void> {
    const folder = await foldersRepository.findFolderForCompany(id, companyId);
    if (!folder) throw new AppError(404, 'Folder not found');
  }
}

export const recordsService = new RecordsService();
