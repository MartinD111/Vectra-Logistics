import type { PoolClient } from 'pg';
import { db } from '../../core/db';
import { AppError } from '../../core/errors/AppError';
import { createDurableEventEnvelope, insertDurableEvent } from '../../core/events';
import { CollectionPropertyDef, DataCollectionRow, CollectionRecordRow, CollectionViewRow } from './records.types';

class RecordsRepository {
  // ── Collections ──
  async createCollectionWithDefaultView(companyId: string, d: {
    name: string; schema: CollectionPropertyDef[]; projectId?: string | null; folderId?: string | null; createdBy: string | null;
    actorId?: string | null; causationId?: string | null; correlationId?: string | null;
  }): Promise<{ collection: DataCollectionRow; view: CollectionViewRow }> {
    const client = await db.connect();
    try {
      await client.query('BEGIN');

      const collectionResult = await client.query<DataCollectionRow>(
        `INSERT INTO data_collections (company_id, project_id, folder_id, name, schema, created_by)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [companyId, d.projectId ?? null, d.folderId ?? null, d.name, JSON.stringify(d.schema ?? []), d.createdBy]);
      const collection = collectionResult.rows[0];

      const viewResult = await client.query<CollectionViewRow>(
        `INSERT INTO collection_views (company_id, collection_id, name, type, config)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [companyId, collection.id, 'Table', 'table', JSON.stringify({})]);
      const view = viewResult.rows[0];

      await insertDurableEvent(client, createDurableEventEnvelope({
        eventName: 'records.collection.created',
        tenantId: companyId,
        actorId: d.actorId ?? d.createdBy,
        objectType: 'data_collection',
        objectId: collection.id,
        projectId: collection.project_id,
        causationId: d.causationId ?? null,
        correlationId: d.correlationId ?? null,
        payloadVersion: 1,
        payload: {
          collection: {
            id: collection.id,
            name: collection.name,
            schema: collection.schema,
          },
          defaultView: {
            id: view.id,
            name: view.name,
            type: view.type,
          },
        },
      }));

      await client.query('COMMIT');
      return { collection, view };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async findCollection(id: string, companyId: string): Promise<DataCollectionRow | null> {
    const { rows } = await db.query<DataCollectionRow>(
      `SELECT * FROM data_collections WHERE id = $1 AND company_id = $2`, [id, companyId]);
    return rows[0] ?? null;
  }

  async listCollections(companyId: string): Promise<DataCollectionRow[]> {
    const { rows } = await db.query<DataCollectionRow>(
      `SELECT * FROM data_collections WHERE company_id = $1 ORDER BY created_at ASC`, [companyId]);
    return rows;
  }

  async updateCollection(id: string, companyId: string, patch: Partial<{
    name: string; schema: CollectionPropertyDef[]; project_id: string | null; folder_id: string | null;
  }>): Promise<DataCollectionRow | null> {
    const sets: string[] = [];
    const params: unknown[] = [id, companyId];
    for (const [col, val] of Object.entries(patch)) {
      if (val === undefined) continue;
      params.push(col === 'schema' ? JSON.stringify(val) : val);
      sets.push(`${col} = $${params.length}`);
    }
    if (sets.length === 0) return this.findCollection(id, companyId);
    sets.push('updated_at = NOW()');
    const { rows } = await db.query<DataCollectionRow>(
      `UPDATE data_collections SET ${sets.join(', ')} WHERE id = $1 AND company_id = $2 RETURNING *`, params);
    return rows[0] ?? null;
  }

  // TREEAPI-02: lock-safe sibling renumber (folder-scoped siblings only —
  // data_collections doesn't disambiguate by project_id the way programs does).
  async reorderCollections(
    client: PoolClient, companyId: string, folderId: string | null, orderedIds: string[],
  ): Promise<void> {
    const { rows: locked } = await client.query<{ id: string }>(
      `SELECT id FROM data_collections
       WHERE company_id = $1 AND folder_id IS NOT DISTINCT FROM $2 AND archived_at IS NULL
       FOR UPDATE`,
      [companyId, folderId],
    );
    const lockedIds = new Set(locked.map((r) => r.id));
    if (lockedIds.size !== orderedIds.length || !orderedIds.every((id) => lockedIds.has(id))) {
      throw new AppError(409, 'Sibling set has changed since last read — refresh and retry');
    }
    if (orderedIds.length === 0) return;
    const values = orderedIds.map((_, i) => `($${i + 3}::uuid,${i})`).join(',');
    await client.query(
      `UPDATE data_collections AS c SET sort_order = v.pos, updated_at = NOW()
       FROM (VALUES ${values}) AS v(id, pos)
       WHERE c.id = v.id`,
      [companyId, folderId, ...orderedIds],
    );
  }

  // HIER-04: bulk-archive collections filed directly into a set of folders
  // (pass 1 of the folders-domain cascade owned by foldersService.archiveFolder).
  // Takes an explicit client so it runs inside the caller's transaction.
  async archiveCollectionsInFolders(client: PoolClient, folderIds: string[], companyId: string): Promise<DataCollectionRow[]> {
    const { rows } = await client.query<DataCollectionRow>(
      `UPDATE data_collections
       SET archived_at = NOW(), updated_at = NOW()
       WHERE company_id = $1 AND folder_id = ANY($2::uuid[]) AND archived_at IS NULL
       RETURNING *`,
      [companyId, folderIds]);
    for (const collection of rows) {
      await insertDurableEvent(client, createDurableEventEnvelope({
        eventName: 'data_collection.archived',
        tenantId: companyId,
        objectType: 'data_collection',
        objectId: collection.id,
        projectId: collection.project_id,
        payloadVersion: 1,
        payload: { collection: { id: collection.id, name: collection.name } },
      }));
    }
    return rows;
  }

  // HIER-04: bulk-archive collections filed by project_id (pass 2 of the
  // cascade — catches collections attached via project_id but not folder_id).
  async archiveCollectionsInProjects(client: PoolClient, projectIds: string[], companyId: string): Promise<DataCollectionRow[]> {
    const { rows } = await client.query<DataCollectionRow>(
      `UPDATE data_collections
       SET archived_at = NOW(), updated_at = NOW()
       WHERE company_id = $1 AND project_id = ANY($2::uuid[]) AND archived_at IS NULL
       RETURNING *`,
      [companyId, projectIds]);
    for (const collection of rows) {
      await insertDurableEvent(client, createDurableEventEnvelope({
        eventName: 'data_collection.archived',
        tenantId: companyId,
        objectType: 'data_collection',
        objectId: collection.id,
        projectId: collection.project_id,
        payloadVersion: 1,
        payload: { collection: { id: collection.id, name: collection.name } },
      }));
    }
    return rows;
  }

  // D-03: standalone single-row restore, not part of a cascade — uses the
  // module-level db pool rather than a passed client.
  async unarchiveCollection(id: string, companyId: string): Promise<DataCollectionRow | null> {
    const { rows } = await db.query<DataCollectionRow>(
      `UPDATE data_collections SET archived_at = NULL, updated_at = NOW()
       WHERE id = $1 AND company_id = $2 RETURNING *`,
      [id, companyId]);
    return rows[0] ?? null;
  }

  // ── Records ──
  async createRecord(companyId: string, d: {
    collectionId: string; parentRecordId: string | null;
    props?: Record<string, unknown>; body?: Record<string, unknown>; createdBy: string | null;
  }): Promise<CollectionRecordRow> {
    const { rows } = await db.query<CollectionRecordRow>(
      `INSERT INTO collection_records (company_id, collection_id, parent_record_id, props, body, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [
        companyId, d.collectionId, d.parentRecordId ?? null,
        JSON.stringify(d.props ?? {}),
        JSON.stringify(d.body ?? { version: 1, blocks: [] }),
        d.createdBy,
      ]);
    return rows[0];
  }

  async findRecord(id: string, companyId: string): Promise<CollectionRecordRow | null> {
    const { rows } = await db.query<CollectionRecordRow>(
      `SELECT * FROM collection_records WHERE id = $1 AND company_id = $2`, [id, companyId]);
    return rows[0] ?? null;
  }

  async listRecords(collectionId: string, companyId: string): Promise<CollectionRecordRow[]> {
    const { rows } = await db.query<CollectionRecordRow>(
      `SELECT * FROM collection_records WHERE collection_id = $1 AND company_id = $2
       ORDER BY sort_order ASC, created_at ASC`,
      [collectionId, companyId]);
    return rows;
  }

  async updateRecord(id: string, companyId: string, patch: Partial<{
    props: Record<string, unknown>; body: Record<string, unknown>;
    parent_record_id: string | null; sort_order: number;
  }>): Promise<CollectionRecordRow | null> {
    const sets: string[] = [];
    const params: unknown[] = [id, companyId];
    for (const [col, val] of Object.entries(patch)) {
      if (val === undefined) continue;
      params.push(col === 'props' || col === 'body' ? JSON.stringify(val) : val);
      sets.push(`${col} = $${params.length}`);
    }
    if (sets.length === 0) return this.findRecord(id, companyId);
    sets.push('updated_at = NOW()');
    const { rows } = await db.query<CollectionRecordRow>(
      `UPDATE collection_records SET ${sets.join(', ')} WHERE id = $1 AND company_id = $2 RETURNING *`, params);
    return rows[0] ?? null;
  }

  async listChildren(parentRecordId: string, companyId: string): Promise<CollectionRecordRow[]> {
    const { rows } = await db.query<CollectionRecordRow>(
      `SELECT * FROM collection_records WHERE parent_record_id = $1 AND company_id = $2
       ORDER BY sort_order ASC, created_at ASC`,
      [parentRecordId, companyId]);
    return rows;
  }

  // ── Views ──
  async createView(companyId: string, d: {
    collectionId: string; name: string; type: string; config?: Record<string, unknown>;
  }): Promise<CollectionViewRow> {
    const { rows } = await db.query<CollectionViewRow>(
      `INSERT INTO collection_views (company_id, collection_id, name, type, config)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [companyId, d.collectionId, d.name, d.type, JSON.stringify(d.config ?? {})]);
    return rows[0];
  }

  async findView(id: string, companyId: string): Promise<CollectionViewRow | null> {
    const { rows } = await db.query<CollectionViewRow>(
      `SELECT * FROM collection_views WHERE id = $1 AND company_id = $2`, [id, companyId]);
    return rows[0] ?? null;
  }

  async listViews(collectionId: string, companyId: string): Promise<CollectionViewRow[]> {
    const { rows } = await db.query<CollectionViewRow>(
      `SELECT * FROM collection_views WHERE collection_id = $1 AND company_id = $2 ORDER BY sort_order ASC`,
      [collectionId, companyId]);
    return rows;
  }

  async updateView(id: string, companyId: string, patch: Partial<{
    name: string; type: string; config: Record<string, unknown>; sort_order: number;
  }>): Promise<CollectionViewRow | null> {
    const sets: string[] = [];
    const params: unknown[] = [id, companyId];
    for (const [col, val] of Object.entries(patch)) {
      if (val === undefined) continue;
      params.push(col === 'config' ? JSON.stringify(val) : val);
      sets.push(`${col} = $${params.length}`);
    }
    if (sets.length === 0) return this.findView(id, companyId);
    const { rows } = await db.query<CollectionViewRow>(
      `UPDATE collection_views SET ${sets.join(', ')} WHERE id = $1 AND company_id = $2 RETURNING *`, params);
    return rows[0] ?? null;
  }
}

export const recordsRepository = new RecordsRepository();
