// Starter templates are just MiniProgramConfig objects — adding one is zero code.
// They are optional launch points, NOT program "types": every starter is fully
// editable and can mix in any block afterwards. The three below mirror common
// shapes seen across the company's hand-written tools.

import { emptyMiniProgram, uid, type MiniProgramConfig } from './blocks';

export interface StarterTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  accent: string;
  build: () => MiniProgramConfig;
}

export const STARTERS: StarterTemplate[] = [
  {
    id: 'blank',
    name: 'Blank program',
    description: 'Start from scratch and add any blocks you like.',
    icon: 'Type',
    accent: '#64748b',
    build: () => emptyMiniProgram('Untitled program'),
  },
  {
    id: 'extractor',
    name: 'Data extractor',
    description: 'Drop Excel / CSV / ZIP → auto-detect columns → clean → results table → export & copy.',
    icon: 'UploadCloud',
    accent: '#2563eb',
    build: (): MiniProgramConfig => ({
      version: 2,
      meta: { title: 'Data Extractor', subtitle: 'Upload files and pull out what you need', icon: 'UploadCloud', accent: '#2563eb' },
      blocks: [
        { id: uid(), kind: 'file-input', label: 'Upload files', accept: ['xlsx', 'csv', 'zip'], multiple: true, headerAutoDetect: true },
        { id: uid(), kind: 'transform', steps: [] },
        { id: uid(), kind: 'table', columns: [], emptyText: 'Results will appear here' },
        { id: uid(), kind: 'export', label: 'Export', formats: ['xlsx', 'csv', 'pdf'], fileName: 'extraction', saveToFolder: true },
        { id: uid(), kind: 'copy', label: 'Copy all', source: 'all' },
      ],
    }),
  },
  {
    id: 'generator',
    name: 'Document / email generator',
    description: 'Paste or upload data → fill a template with {{placeholders}} → generate emails, PDFs or printouts per row.',
    icon: 'FileText',
    accent: '#7c3aed',
    build: (): MiniProgramConfig => ({
      version: 2,
      meta: { title: 'Document Generator', subtitle: 'Turn a list into documents', icon: 'FileText', accent: '#7c3aed' },
      blocks: [
        { id: uid(), kind: 'paste-input', label: 'Paste recipients', delimiter: 'auto', hasHeader: true, placeholder: 'Name\tEmail\nJane Doe\tjane@acme.com' },
        { id: uid(), kind: 'table', columns: [], emptyText: 'Rows will appear here' },
        {
          id: uid(), kind: 'document', label: 'Generate', mode: 'per-row', output: 'eml', fileName: 'draft',
          eml: { to: '{{Email}}', subject: 'Following up' },
          template: '<p>Hi {{Name}},</p><p>Thank you for your time. I’d love to follow up.</p><p>Best regards</p>',
        },
      ],
    }),
  },
  {
    id: 'manager',
    name: 'Records manager',
    description: 'A form that builds up a list of saved records you can review, export and print.',
    icon: 'ListChecks',
    accent: '#059669',
    build: (): MiniProgramConfig => ({
      version: 2,
      meta: { title: 'Records Manager', subtitle: 'Collect and track entries', icon: 'ListChecks', accent: '#059669' },
      blocks: [
        {
          id: uid(), kind: 'form', title: 'New entry', target: 'records', submitLabel: 'Add record',
          fields: [
            { key: 'reference', label: 'Reference', type: 'text', required: true },
            { key: 'description', label: 'Description', type: 'textarea' },
            { key: 'status', label: 'Status', type: 'select', options: ['Open', 'In progress', 'Done'] },
          ],
        },
        { id: uid(), kind: 'records', title: 'Entries', fields: [] },
      ],
    }),
  },
];

export function starterById(id: string): StarterTemplate | undefined {
  return STARTERS.find((s) => s.id === id);
}
