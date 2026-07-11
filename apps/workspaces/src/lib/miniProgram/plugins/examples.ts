import type { PluginBlockManifest } from './manifest';

// Built-in example plugins. These demonstrate the manifest format end-to-end and
// seed the registry so the plugin system is usable immediately. Real installs
// (company-scoped, marketplace) arrive in Phase K; these are the reference
// shapes AI-authored plugins (Phase J) are validated against.

const dedupe: PluginBlockManifest = {
  id: 'vectra.dedupe',
  version: '1.0.0',
  title: 'Deduplicate rows',
  description: 'Remove duplicate rows, keeping the first occurrence of each value in a chosen column.',
  icon: 'CopyMinus',
  group: 'process',
  origin: 'builtin',
  settingsSchema: [
    { key: 'column', label: 'Unique by column', type: 'column' },
  ],
  uiSchema: [
    { node: 'text', text: 'Keeps the first row for each distinct value of "{{config.column}}".', variant: 'muted' },
    { node: 'badge', text: '{{vars.__dedupe_kept}} kept', tone: 'success' },
  ],
  logic: {
    kind: 'transform',
    source: `
      var col = config.column;
      if (!col) return { rows: rows };
      var seen = {};
      var out = [];
      for (var i = 0; i < rows.length; i++) {
        var key = String(rows[i][col]);
        if (!seen[key]) { seen[key] = true; out.push(rows[i]); }
      }
      return { rows: out, vars: { __dedupe_kept: out.length } };
    `,
  },
};

const wordCount: PluginBlockManifest = {
  id: 'vectra.wordcount',
  version: '1.0.0',
  title: 'Word count column',
  description: 'Add a column with the number of words in a chosen text column.',
  icon: 'Hash',
  group: 'process',
  origin: 'builtin',
  settingsSchema: [
    { key: 'column', label: 'Text column', type: 'column' },
    { key: 'into', label: 'New column name', type: 'text', default: 'word_count' },
  ],
  uiSchema: [
    { node: 'text', text: 'Counts words in "{{config.column}}" → "{{config.into}}".', variant: 'muted' },
  ],
  logic: {
    kind: 'transform',
    source: `
      var col = config.column;
      var into = config.into || 'word_count';
      if (!col) return { rows: rows };
      return rows.map(function (r) {
        var copy = {};
        for (var k in r) copy[k] = r[k];
        var text = r[col] == null ? '' : String(r[col]).trim();
        copy[into] = text ? text.split(/\\s+/).length : 0;
        return copy;
      });
    `,
  },
};

const rowCountCallout: PluginBlockManifest = {
  id: 'vectra.rowcountcallout',
  version: '1.0.0',
  title: 'Row count callout',
  description: 'Shows a highlighted badge with the current row count of the incoming dataset.',
  icon: 'MessagesSquare',
  group: 'output',
  origin: 'builtin',
  settingsSchema: [],
  uiSchema: [
    { node: 'text', text: 'Current dataset:', variant: 'muted' },
    { node: 'badge', text: '{{count}} rows', tone: 'neutral' },
  ],
  logic: { kind: 'transform', source: 'return { rows: rows };' },
};

export const EXAMPLE_PLUGINS: PluginBlockManifest[] = [dedupe, wordCount, rowCountCallout];
