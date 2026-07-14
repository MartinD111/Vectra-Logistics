'use client';

// Phase 24 (BOARD-04): editor-path wrapper around the legacy KanbanBoardView.
// Renders the unchanged legacy board so viewing/inserting a kanban block
// behaves exactly as before, but ref-gates the FIRST edit (add/remove/move
// card) to silently, lazily migrate the block to a real collection-view
// board — preserving the triggering edit itself, plus a one-time
// auto-dismissing toast. Never fires on page load/view, never fires twice.

import { useRef, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import type { KanbanBlock, PageBlock } from '@/lib/projectPage/blocks';
import { KanbanBoardView } from '@/components/projectPage/KanbanBlock';
import { migrateOnFirstEdit } from '@/lib/projectPage/kanbanMigration';

export function KanbanMigrationGate({
  block,
  onUpdate,
}: {
  block: KanbanBlock;
  onUpdate: (block: PageBlock) => void;
}) {
  const migratingRef = useRef(false);
  const [showToast, setShowToast] = useState(false);

  const handleChange = (nextKanbanBlock: KanbanBlock) => {
    if (migratingRef.current) return;
    migratingRef.current = true;

    migrateOnFirstEdit(nextKanbanBlock)
      .then((migratedBlock) => {
        onUpdate(migratedBlock);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 4000);
      })
      .catch((err) => {
        console.error('Kanban migration failed:', err);
        // Keep the user's in-progress edit applied to the legacy block, and
        // reset the gate so the next edit retries — never leave a
        // half-migrated / orphaned collection-view pointer behind.
        onUpdate(nextKanbanBlock);
        migratingRef.current = false;
      });
  };

  return (
    <>
      <KanbanBoardView block={block} onChange={handleChange} />
      {showToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 p-4 rounded-xl text-sm border bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-300 shadow-lg">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          Board upgraded to the new view engine.
        </div>
      )}
    </>
  );
}
