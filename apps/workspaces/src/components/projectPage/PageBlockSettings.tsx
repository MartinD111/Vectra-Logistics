'use client';

// Settings panel for a block on the live canvas. Keyed by `kind`, same pattern
// as miniProgram/BlockSettings.tsx. Blocks with no config (divider, stat-cards,
// calendar, email-campaign) render nothing beyond the span picker, which the
// canvas settings popover renders itself.

import type {
  PageBlock, ChartSource, ChartType,
} from '@/lib/projectPage/blocks';
import { usePrograms } from '@/lib/hooks/useProjects';

export function PageBlockSettings({
  block, projectId, onChange,
}: { block: PageBlock; projectId: string; onChange: (b: PageBlock) => void }) {
  switch (block.kind) {
    case 'heading':
      return (
        <div className="space-y-2">
          <input className="saas-input !py-2 text-sm" value={block.text}
            onChange={(e) => onChange({ ...block, text: e.target.value })} placeholder="Heading text" />
          <select className="saas-input !py-2 text-sm" value={block.level}
            onChange={(e) => onChange({ ...block, level: Number(e.target.value) as 1 | 2 | 3 })}>
            <option value={1}>Large</option>
            <option value={2}>Medium</option>
            <option value={3}>Small</option>
          </select>
        </div>
      );
    case 'rich-text':
      return <p className="text-xs text-gray-400">Edit the text directly in the page.</p>;
    case 'list':
      return (
        <select className="saas-input !py-2 text-sm" value={block.style}
          onChange={(e) => {
            const style = e.target.value as 'bulleted' | 'numbered';
            // Swap the outer tag so the rendered marker style follows the setting.
            const html = style === 'numbered'
              ? block.html.replace(/^<ul>/, '<ol>').replace(/<\/ul>$/, '</ol>')
              : block.html.replace(/^<ol>/, '<ul>').replace(/<\/ol>$/, '</ul>');
            onChange({ ...block, style, html });
          }}>
          <option value="bulleted">Bulleted</option>
          <option value="numbered">Numbered</option>
        </select>
      );
    case 'people':
    case 'kpi-grid':
    case 'activity-timeline':
      return (
        <input className="saas-input !py-2 text-sm" value={block.title ?? ''}
          onChange={(e) => onChange({ ...block, title: e.target.value } as PageBlock)} placeholder="Title (optional)" />
      );
    case 'chart':
      return (
        <div className="space-y-2">
          <input className="saas-input !py-2 text-sm" value={block.title ?? ''}
            onChange={(e) => onChange({ ...block, title: e.target.value })} placeholder="Title (optional)" />
          <select className="saas-input !py-2 text-sm" value={block.source}
            onChange={(e) => onChange({ ...block, source: e.target.value as ChartSource })}>
            <option value="activity-by-day">Activity by day</option>
            <option value="activity-by-verb">Activity by type</option>
            <option value="kpi-results">KPI results</option>
          </select>
          <select className="saas-input !py-2 text-sm" value={block.chartType}
            onChange={(e) => onChange({ ...block, chartType: e.target.value as ChartType })}>
            <option value="bar">Bar</option>
            <option value="line">Line</option>
          </select>
        </div>
      );
    case 'program-link':
      return <ProgramPicker programId={block.programId ?? null} projectId={projectId}
        onChange={(programId) => onChange({ ...block, programId })} />;
    case 'mini-program':
      return <ProgramPicker programId={block.programId} projectId={projectId} required
        onChange={(programId) => onChange({ ...block, programId })} />;
    case 'kanban':
      return (
        <div className="space-y-2">
          <input className="saas-input !py-2 text-sm" value={block.title ?? ''}
            onChange={(e) => onChange({ ...block, title: e.target.value })} placeholder="Title (optional)" />
          {block.columns.map((col, i) => (
            <input key={col.id} className="saas-input !py-2 text-sm" value={col.title}
              onChange={(e) => onChange({
                ...block,
                columns: block.columns.map((c, j) => (j === i ? { ...c, title: e.target.value } : c)),
              })}
              placeholder={`Column ${i + 1}`} />
          ))}
        </div>
      );
    case 'exception-radar':
    case 'smart-inbox':
    case 'drafts-kanban':
    case 'yard-map':
    case 'railway-terminal':
    case 'pod-tracker':
    case 'omni-docs':
    case 'crm-clients':
    case 'vat-matrix':
    case 'invoices':
    case 'ltl-matches':
      return (
        <input className="saas-input !py-2 text-sm" value={block.title ?? ''}
          onChange={(e) => onChange({ ...block, title: e.target.value } as PageBlock)} placeholder="Title (optional)" />
      );
    case 'fleet-telematics':
      return (
        <div className="space-y-2">
          <input className="saas-input !py-2 text-sm" value={block.title ?? ''}
            onChange={(e) => onChange({ ...block, title: e.target.value })} placeholder="Title (optional)" />
          <label className="label-xs">Max vehicles (0 = all)</label>
          <input type="number" min={0} max={12} className="saas-input !py-2 text-sm" value={block.maxVehicles}
            onChange={(e) => onChange({ ...block, maxVehicles: Math.max(0, Number(e.target.value) || 0) })} />
        </div>
      );
    case 'spot-quote':
      return (
        <div className="space-y-2">
          <input className="saas-input !py-2 text-sm" value={block.title ?? ''}
            onChange={(e) => onChange({ ...block, title: e.target.value })} placeholder="Title (optional)" />
          <label className="label-xs">Default margin %</label>
          <input type="number" min={0} max={50} className="saas-input !py-2 text-sm" value={block.defaultMarginPct}
            onChange={(e) => onChange({ ...block, defaultMarginPct: Math.min(50, Math.max(0, Number(e.target.value) || 0)) })} />
        </div>
      );
    case 'omni-chat':
      return (
        <div className="space-y-2">
          <input className="saas-input !py-2 text-sm" value={block.title ?? ''}
            onChange={(e) => onChange({ ...block, title: e.target.value })} placeholder="Title (optional)" />
          <label className="label-xs">Auto-translate incoming to</label>
          <select className="saas-input !py-2 text-sm" value={block.translateTo}
            onChange={(e) => onChange({ ...block, translateTo: e.target.value })}>
            <option value="">Off</option>
            <option value="English">English</option>
            <option value="Slovenian">Slovenian</option>
            <option value="German">German</option>
            <option value="Italian">Italian</option>
            <option value="Croatian">Croatian</option>
            <option value="Polish">Polish</option>
            <option value="French">French</option>
            <option value="Spanish">Spanish</option>
          </select>
        </div>
      );
    default:
      return null;
  }
}

function ProgramPicker({ programId, projectId, required, onChange }: { programId: string | null; projectId: string; required?: boolean; onChange: (id: string | null) => void }) {
  const { data: programs } = usePrograms(projectId);
  return (
    <select className="saas-input !py-2 text-sm" value={programId ?? ''}
      onChange={(e) => onChange(e.target.value || null)}>
      <option value="">{required ? 'Pick a program…' : 'All programs in this project'}</option>
      {(programs ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
    </select>
  );
}
