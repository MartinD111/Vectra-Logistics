'use client';

// Notion-style page header: cover image (gradient presets or pasted URL, with
// vertical reposition), emoji icon picker, inline-editable title, and a small
// settings menu (full width). Metadata saves go straight through
// useUpdateProjectPage partial updates — separate from the config autosave.

import { useEffect, useRef, useState } from 'react';
import {
  Image as ImageIcon, Smile, MoreHorizontal, Trash2, Move, Check, X,
} from 'lucide-react';
import type { ProjectPage } from '@/lib/api/projects.api';
import { parseHeaderSettings } from '@/lib/projectPage/blocks';

export type PageHeaderUpdate = Partial<{
  title: string;
  icon: string | null;
  cover_image_url: string | null;
  header_settings: Record<string, unknown>;
}>;

/** Preset covers stored as "gradient:<name>" tokens in cover_image_url. */
const COVER_PRESETS: Record<string, string> = {
  aurora: 'linear-gradient(120deg, #34d399 0%, #38bdf8 50%, #818cf8 100%)',
  sunset: 'linear-gradient(120deg, #f97316 0%, #f43f5e 60%, #a855f7 100%)',
  ocean: 'linear-gradient(120deg, #0ea5e9 0%, #2563eb 60%, #1e3a8a 100%)',
  forest: 'linear-gradient(120deg, #16a34a 0%, #065f46 70%, #022c22 100%)',
  dusk: 'linear-gradient(120deg, #475569 0%, #6366f1 60%, #0f172a 100%)',
  ember: 'linear-gradient(120deg, #fbbf24 0%, #ea580c 55%, #7c2d12 100%)',
  blossom: 'linear-gradient(120deg, #f9a8d4 0%, #e879f9 55%, #7c3aed 100%)',
  graphite: 'linear-gradient(120deg, #334155 0%, #1e293b 60%, #020617 100%)',
};

const EMOJI_GROUPS: { label: string; emojis: string[] }[] = [
  { label: 'Work', emojis: ['📋', '📊', '📈', '📉', '🗂️', '📁', '🗓️', '📌', '📎', '✅', '📝', '💼', '🗃️', '🧾', '📇', '🔖'] },
  { label: 'Logistics', emojis: ['🚚', '🚛', '🚢', '⚓', '🚆', '🚂', '📦', '🏗️', '🏭', '🛳️', '✈️', '🛰️', '🗺️', '🧭', '⛽', '🛣️'] },
  { label: 'Ideas', emojis: ['💡', '🎯', '🚀', '⭐', '🔥', '⚡', '🧠', '🔍', '🔧', '🛠️', '⚙️', '🧪', '🎨', '🏆', '📣', '💬'] },
  { label: 'Misc', emojis: ['🏠', '🌍', '☀️', '🌙', '🌈', '🍀', '🎉', '❤️', '💰', '⏰', '🔒', '🔑', '📞', '✉️', '🧊', '🌊'] },
];

export function PageHeader({
  page, onUpdate,
}: { page: ProjectPage; onUpdate: (data: PageHeaderUpdate) => void }) {
  const settings = parseHeaderSettings(page.header_settings);
  const [coverMenu, setCoverMenu] = useState(false);
  const [iconMenu, setIconMenu] = useState(false);
  const [moreMenu, setMoreMenu] = useState(false);
  const [urlDraft, setUrlDraft] = useState('');
  const [repositioning, setRepositioning] = useState(false);
  const [posDraft, setPosDraft] = useState(settings.cover_position);
  const dragState = useRef<{ startY: number; startPos: number } | null>(null);

  const cover = page.cover_image_url;
  const isGradient = !!cover?.startsWith('gradient:');
  const gradientCss = isGradient ? COVER_PRESETS[cover!.slice('gradient:'.length)] : undefined;

  const closeMenus = () => { setCoverMenu(false); setIconMenu(false); setMoreMenu(false); };

  return (
    <div className="relative group/header mb-6">
      {/* ── Cover ── */}
      {cover ? (
        <div
          className={`relative h-44 -mx-4 lg:-mx-8 rounded-none lg:rounded-xl overflow-hidden ${repositioning ? 'cursor-ns-resize select-none' : ''}`}
          style={
            gradientCss
              ? { background: gradientCss }
              : {
                  backgroundImage: `url(${cover})`,
                  backgroundSize: 'cover',
                  backgroundPositionY: `${repositioning ? posDraft : settings.cover_position}%`,
                }
          }
          onMouseDown={(e) => {
            if (!repositioning || gradientCss) return;
            dragState.current = { startY: e.clientY, startPos: posDraft };
          }}
          onMouseMove={(e) => {
            if (!repositioning || !dragState.current) return;
            const delta = ((e.clientY - dragState.current.startY) / 176) * 100;
            setPosDraft(Math.min(100, Math.max(0, dragState.current.startPos - delta)));
          }}
          onMouseUp={() => { dragState.current = null; }}
          onMouseLeave={() => { dragState.current = null; }}
        >
          <div className="absolute top-3 right-4 flex items-center gap-1.5 opacity-0 group-hover/header:opacity-100 transition-opacity">
            {repositioning ? (
              <>
                <span className="text-[11px] font-semibold text-white/90 bg-black/40 rounded-md px-2 py-1">Drag to reposition</span>
                <HeaderChip onClick={() => { setRepositioning(false); onUpdate({ header_settings: { ...page.header_settings, cover_position: Math.round(posDraft) } }); }}>
                  <Check className="w-3.5 h-3.5" /> Save
                </HeaderChip>
                <HeaderChip onClick={() => { setRepositioning(false); setPosDraft(settings.cover_position); }}>
                  <X className="w-3.5 h-3.5" /> Cancel
                </HeaderChip>
              </>
            ) : (
              <>
                <HeaderChip onClick={() => { closeMenus(); setCoverMenu(true); }}>
                  <ImageIcon className="w-3.5 h-3.5" /> Change
                </HeaderChip>
                {!isGradient && (
                  <HeaderChip onClick={() => { closeMenus(); setPosDraft(settings.cover_position); setRepositioning(true); }}>
                    <Move className="w-3.5 h-3.5" /> Reposition
                  </HeaderChip>
                )}
                <HeaderChip onClick={() => onUpdate({ cover_image_url: null })}>
                  <Trash2 className="w-3.5 h-3.5" /> Remove
                </HeaderChip>
              </>
            )}
          </div>
        </div>
      ) : null}

      {/* ── Icon + ghost actions ── */}
      <div className={cover ? '-mt-7 relative z-10' : 'pt-2'}>
        {page.icon ? (
          <button
            onClick={() => { closeMenus(); setIconMenu(true); }}
            className="text-5xl leading-none hover:scale-110 transition-transform"
            title="Change icon"
          >
            {page.icon}
          </button>
        ) : null}

        <div className={`flex items-center gap-2 mt-2 opacity-0 group-hover/header:opacity-100 transition-opacity ${page.icon || cover ? '' : ''}`}>
          {!page.icon && (
            <GhostButton onClick={() => { closeMenus(); setIconMenu(true); }}>
              <Smile className="w-3.5 h-3.5" /> Add icon
            </GhostButton>
          )}
          {!cover && (
            <GhostButton onClick={() => { closeMenus(); setCoverMenu(true); }}>
              <ImageIcon className="w-3.5 h-3.5" /> Add cover
            </GhostButton>
          )}
          <GhostButton onClick={() => { closeMenus(); setMoreMenu(true); }}>
            <MoreHorizontal className="w-3.5 h-3.5" />
          </GhostButton>
        </div>

        {/* ── Title ── */}
        <EditableTitle title={page.title} onCommit={(title) => onUpdate({ title })} />
      </div>

      {/* ── Popovers ── */}
      {coverMenu && (
        <Popover onClose={() => setCoverMenu(false)}>
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Gradients</p>
          <div className="grid grid-cols-4 gap-2 mb-3">
            {Object.entries(COVER_PRESETS).map(([name, css]) => (
              <button key={name} title={name}
                onClick={() => { onUpdate({ cover_image_url: `gradient:${name}` }); setCoverMenu(false); }}
                className="h-10 rounded-lg border border-gray-200 dark:border-slate-700 hover:ring-2 hover:ring-primary-400"
                style={{ background: css }} />
            ))}
          </div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Image URL</p>
          <div className="flex gap-1.5">
            <input value={urlDraft} onChange={(e) => setUrlDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && urlDraft.trim()) { onUpdate({ cover_image_url: urlDraft.trim() }); setUrlDraft(''); setCoverMenu(false); }
              }}
              placeholder="https://…"
              className="saas-input !py-1.5 text-sm flex-1" />
            <button
              onClick={() => { if (urlDraft.trim()) { onUpdate({ cover_image_url: urlDraft.trim() }); setUrlDraft(''); setCoverMenu(false); } }}
              className="px-3 py-1.5 rounded-lg bg-primary-600 text-white text-xs font-semibold hover:bg-primary-700">
              Set
            </button>
          </div>
        </Popover>
      )}

      {iconMenu && (
        <Popover onClose={() => setIconMenu(false)}>
          {EMOJI_GROUPS.map((g) => (
            <div key={g.label} className="mb-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">{g.label}</p>
              <div className="grid grid-cols-8 gap-0.5">
                {g.emojis.map((e) => (
                  <button key={e} onClick={() => { onUpdate({ icon: e }); setIconMenu(false); }}
                    className="h-8 w-8 rounded-lg text-lg hover:bg-gray-100 dark:hover:bg-slate-800 flex items-center justify-center">
                    {e}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {page.icon && (
            <button onClick={() => { onUpdate({ icon: null }); setIconMenu(false); }}
              className="w-full mt-1 px-2 py-1.5 rounded-lg text-xs font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 text-left">
              Remove icon
            </button>
          )}
        </Popover>
      )}

      {moreMenu && (
        <Popover onClose={() => setMoreMenu(false)}>
          <label className="flex items-center justify-between gap-3 px-1 py-1 cursor-pointer">
            <span className="text-sm text-gray-700 dark:text-gray-200">Full width</span>
            <input type="checkbox" checked={settings.full_width}
              onChange={(e) => onUpdate({ header_settings: { ...page.header_settings, full_width: e.target.checked } })}
              className="h-4 w-4 accent-primary-600" />
          </label>
        </Popover>
      )}
    </div>
  );
}

function EditableTitle({ title, onCommit }: { title: string; onCommit: (title: string) => void }) {
  const ref = useRef<HTMLHeadingElement>(null);
  // Uncontrolled contentEditable — React must not manage its children (any
  // re-render would reset the DOM mid-typing). Sync only while unfocused.
  useEffect(() => {
    const el = ref.current;
    if (!el || document.activeElement === el) return;
    if ((el.textContent ?? '') !== title) el.textContent = title;
  }, [title]);
  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <h1
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      className="text-3xl font-black tracking-tight text-gray-900 dark:text-white mt-2 focus:outline-none rounded-lg -mx-1 px-1 focus:ring-2 focus:ring-primary-200 dark:focus:ring-primary-900"
      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLElement).blur(); } }}
      onBlur={() => {
        const next = (ref.current?.textContent ?? '').trim();
        if (next && next !== title) onCommit(next);
        else if (!next && ref.current) ref.current.textContent = title; // don't allow empty titles
      }}
    />
  );
}

function HeaderChip({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="inline-flex items-center gap-1 rounded-md bg-black/40 hover:bg-black/60 text-white text-[11px] font-semibold px-2 py-1 backdrop-blur-sm transition-colors">
      {children}
    </button>
  );
}

function GhostButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors">
      {children}
    </button>
  );
}

function Popover({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <>
      <div className="fixed inset-0 z-20" onClick={onClose} />
      <div className="absolute z-30 mt-1 w-80 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl p-3">
        {children}
      </div>
    </>
  );
}
