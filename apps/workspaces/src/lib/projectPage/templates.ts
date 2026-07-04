// Starter page templates — plain PageConfig objects, zero code. Fully editable
// after creation; these are just convenient starting points.

import { emptyPageConfig, uid, type PageConfig } from './blocks';

export interface PageStarterTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  build: () => PageConfig;
}

export const PAGE_STARTERS: PageStarterTemplate[] = [
  {
    id: 'blank',
    name: 'Blank page',
    description: 'Start from scratch and add any blocks you like.',
    icon: 'FileText',
    build: emptyPageConfig,
  },
  {
    id: 'dashboard',
    name: 'Project dashboard',
    description: 'Stat cards, KPI grid, activity chart and timeline.',
    icon: 'LayoutDashboard',
    build: (): PageConfig => ({
      version: 1,
      blocks: [
        { id: uid(), kind: 'stat-cards', span: 'full' },
        { id: uid(), kind: 'kpi-grid', span: 'half', title: 'KPIs' },
        { id: uid(), kind: 'chart', span: 'half', title: 'Activity', source: 'activity-by-day', chartType: 'bar' },
        { id: uid(), kind: 'activity-timeline', span: 'full', title: 'Activity', pageSize: 20 },
      ],
    }),
  },
  {
    id: 'brief',
    name: 'Project brief',
    description: 'A doc-style page with notes, people and linked programs.',
    icon: 'NotebookText',
    build: (): PageConfig => ({
      version: 1,
      blocks: [
        { id: uid(), kind: 'heading', span: 'full', text: 'Overview', level: 2 },
        { id: uid(), kind: 'rich-text', span: 'full', html: '<p>Write a short brief for this project…</p>' },
        { id: uid(), kind: 'people', span: 'half', title: 'People' },
        { id: uid(), kind: 'program-link', span: 'third', programId: null },
      ],
    }),
  },
];
