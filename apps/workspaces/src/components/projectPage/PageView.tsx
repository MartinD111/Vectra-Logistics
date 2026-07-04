'use client';

import { SPAN_COLS, type PageConfig } from '@/lib/projectPage/blocks';
import { PageBlockView } from './PageBlockView';

export function PageView({ config, projectId }: { config: PageConfig; projectId: string }) {
  if (config.blocks.length === 0) {
    return <div className="py-16 text-center text-sm text-gray-400">This page is empty.</div>;
  }
  return (
    <div className="grid grid-cols-6 gap-4">
      {config.blocks.map((b) => (
        <div key={b.id} style={{ gridColumn: `span ${SPAN_COLS[b.span]} / span ${SPAN_COLS[b.span]}` }}>
          <PageBlockView block={b} projectId={projectId} />
        </div>
      ))}
    </div>
  );
}
