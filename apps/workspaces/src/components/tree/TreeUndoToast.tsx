'use client';

import { useEffect } from 'react';

export function TreeUndoToast({
  nodeName,
  onUndo,
  onDismiss,
}: {
  nodeName: string;
  onUndo: () => void;
  onDismiss: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(), 4000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 p-4 rounded-xl text-sm border bg-white dark:bg-slate-900 shadow-lg">
      <span>
        &quot;{nodeName}&quot; archived.{' '}
        <button
          type="button"
          onClick={onUndo}
          className="font-semibold text-primary-600 hover:opacity-70"
        >
          Undo
        </button>
      </span>
    </div>
  );
}
