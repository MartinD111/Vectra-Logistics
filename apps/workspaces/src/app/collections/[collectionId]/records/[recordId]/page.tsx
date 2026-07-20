'use client';

// Record detail page (CARD-01..04): a full-page composition of PropertyPanel
// (title + schema-driven properties) and the shared block canvas
// (LivePageCanvas, zero new props). Seed-once + 1500ms debounced-autosave
// body editor, cloned from records/[clientId]/page.tsx's canvas-config
// pattern — but WITHOUT the default-block-seeding effect: records have no
// "seed default blocks on first empty visit" requirement (RESEARCH.md).

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useCollection, useRecord, useUpdateRecord, useUpdateCollectionSchema } from '@/lib/hooks/useRecords';
import { isPageConfig, emptyPageConfig, type PageConfig } from '@/lib/projectPage/blocks';
import LivePageCanvas from '@/components/projectPage/LivePageCanvas';
import { PropertyPanel } from '@/components/records/PropertyPanel';
import Breadcrumbs from '@/components/shared/Breadcrumbs';

export default function RecordDetailPage() {
  const params = useParams<{ collectionId: string; recordId: string }>();
  const collectionId = params?.collectionId as string;
  const recordId = params?.recordId as string;

  const { data: collection, isLoading: collectionLoading } = useCollection(collectionId);
  const { data: record, isLoading: recordLoading, isError: recordError } = useRecord(recordId);
  const updateRecord = useUpdateRecord(recordId);
  const updateSchema = useUpdateCollectionSchema(collectionId);

  // ── Canvas config: seed-once + debounced autosave, mirroring the CRM
  // client-detail-page pattern (records/[clientId]/page.tsx) — but seeded
  // from record.body instead of page.config, and with no default-block
  // seeding effect (records have no "seed defaults on first visit" need).
  const [config, setConfig] = useState<PageConfig>(emptyPageConfig());
  const [seeded, setSeeded] = useState(false);
  const [canvasSaveError, setCanvasSaveError] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyRef = useRef(false);
  const configRef = useRef(config);
  const updateRecordRef = useRef(updateRecord);
  const seededConfigRef = useRef<PageConfig | null>(null);
  configRef.current = config;
  updateRecordRef.current = updateRecord;

  if (!seeded && record) {
    const initial = isPageConfig(record.body) ? record.body : emptyPageConfig();
    seededConfigRef.current = initial;
    setConfig(initial);
    setSeeded(true);
  }

  useEffect(() => {
    // Skip the effect run caused by seeding itself — only user edits save.
    if (!seeded || config === seededConfigRef.current) return;
    dirtyRef.current = true;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const pending = config;
      updateRecordRef.current.mutate(
        { body: pending as unknown as Record<string, unknown> },
        {
          onSuccess: () => {
            // Only clear dirty if no newer edit has occurred since this save started.
            if (configRef.current === pending) dirtyRef.current = false;
            setCanvasSaveError(false);
          },
          onError: () => setCanvasSaveError(true),
        },
      );
    }, 1500);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, seeded]);

  // Flush a pending save when leaving the page.
  useEffect(() => {
    return () => {
      if (dirtyRef.current) {
        updateRecordRef.current.mutate({ body: configRef.current as unknown as Record<string, unknown> });
      }
    };
  }, []);

  if (collectionLoading || recordLoading) {
    return (
      <div className="flex items-center gap-2 text-gray-400 py-20 justify-center">
        <Loader2 className="w-5 h-5 animate-spin" /> Loading…
      </div>
    );
  }

  if (recordError || !record || !collection) {
    return (
      <div className="max-w-lg mx-auto px-6 py-24 text-center">
        <p className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{"Couldn't load this record."}</p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Check your connection and try again, or return to the collection.
        </p>
      </div>
    );
  }

  const titleProperty = collection.schema[0];
  const recordTitle = titleProperty && typeof record.props[titleProperty.id] === 'string'
    ? (record.props[titleProperty.id] as string)
    : 'Untitled';

  return (
    <div className="min-h-[calc(100vh-64px)] bg-gray-50/50 dark:bg-dark-bg">
      <div className="max-w-6xl mx-auto px-4 lg:px-8 pt-8">
        {collection && <Breadcrumbs nodeType="data_collection" id={collectionId} trailingLabel={recordTitle} />}
      </div>
      <div className="max-w-6xl mx-auto px-4 lg:px-8 pb-8 flex gap-6 items-start">
        <PropertyPanel collection={collection} record={record} onUpdateRecord={updateRecord} onUpdateSchema={updateSchema} />
        <div className="flex-1 min-w-0">
          {canvasSaveError && (
            <p className="text-[11px] text-red-500 mb-2">Couldn&apos;t save your changes — try again.</p>
          )}
          <LivePageCanvas config={config} onChange={setConfig} />
        </div>
      </div>
    </div>
  );
}
