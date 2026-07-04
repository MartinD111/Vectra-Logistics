'use client';

// Railway terminal board: rail wagons grouped by status (In port → Loading
// sequence → In transit → Discharging). Wagons advance/retreat between columns
// live (socket 'yard:wagon'). Demo wagons are seeded on first load.

import { Loader2, TrainTrack, TrainFront, ChevronLeft, ChevronRight } from 'lucide-react';
import type { RailwayTerminalBlock as RailwayTerminalBlockType } from '@/lib/projectPage/blocks';
import { useWagons, useUpdateWagon } from '@/lib/hooks/useYard';
import type { RailWagon, WagonStatus } from '@/lib/api/yard.api';

const COLUMNS: { status: WagonStatus; title: string; accent: string }[] = [
  { status: 'in_port', title: 'In port', accent: 'text-sky-600' },
  { status: 'loading_sequence', title: 'Loading sequence', accent: 'text-amber-600' },
  { status: 'in_transit', title: 'In transit', accent: 'text-primary-600' },
  { status: 'discharging', title: 'Discharging', accent: 'text-emerald-600' },
];
const ORDER: WagonStatus[] = COLUMNS.map((c) => c.status);

export function RailwayTerminalView({ block }: { block: RailwayTerminalBlockType }) {
  const { data: wagons, isLoading } = useWagons();
  const update = useUpdateWagon();

  const byStatus = (status: WagonStatus) =>
    (wagons ?? []).filter((w) => w.status === status).sort((a, b) => a.seq - b.seq);

  const move = (wagon: RailWagon, dir: -1 | 1) => {
    const i = ORDER.indexOf(wagon.status);
    const next = ORDER[i + dir];
    if (next) update.mutate({ id: wagon.id, status: next });
  };

  return (
    <div className="saas-card !p-4">
      <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-1.5">
        <TrainTrack className="w-4 h-4 text-gray-400" /> {block.title || 'Railway terminal'}
        {(wagons?.length ?? 0) > 0 && (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-slate-300">
            {wagons!.length}
          </span>
        )}
      </h3>

      {isLoading ? (
        <div className="flex items-center gap-2 text-gray-400 py-8 justify-center text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Loading wagons…</div>
      ) : (
        <div className="grid grid-cols-4 gap-3">
          {COLUMNS.map((col) => {
            const items = byStatus(col.status);
            return (
              <div key={col.status} className="rounded-lg bg-gray-50 dark:bg-slate-800/60 p-2">
                <div className="flex items-center justify-between px-1 mb-2">
                  <span className={`text-xs font-semibold uppercase tracking-wider ${col.accent}`}>{col.title}</span>
                  <span className="text-[10px] text-gray-400">{items.length}</span>
                </div>
                <div className="space-y-1.5">
                  {items.map((w) => {
                    const i = ORDER.indexOf(w.status);
                    return (
                      <div key={w.id} className="group/wagon rounded-md bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 px-2.5 py-2 shadow-sm">
                        <div className="flex items-center gap-1.5">
                          <TrainFront className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                          <span className="text-xs font-bold text-gray-900 dark:text-white font-mono truncate">{w.wagon_number}</span>
                        </div>
                        {w.cargo && <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 truncate">{w.cargo}</p>}
                        <div className="flex items-center justify-between mt-1 opacity-0 group-hover/wagon:opacity-100 transition-opacity">
                          <button onClick={() => move(w, -1)} disabled={i === 0}
                            className="text-gray-300 hover:text-gray-600 disabled:opacity-30" title="Move back">
                            <ChevronLeft className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => move(w, 1)} disabled={i === ORDER.length - 1}
                            className="text-gray-300 hover:text-gray-600 disabled:opacity-30" title="Advance">
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {items.length === 0 && <p className="text-[11px] text-gray-400 px-1 py-2">Empty</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
