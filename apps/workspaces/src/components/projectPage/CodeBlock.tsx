'use client';

// Fenced code block with a language picker (Phase 21, CONT-04). No syntax
// highlighting — a plain <pre><code> + language label satisfies CONT-04's
// literal wording without a new dependency (RESEARCH.md Assumption A1). The
// body is a controlled <textarea>, not contentEditable — monospace code is
// easier to manage as plain text.

import type { CodeBlock } from '@/lib/projectPage/blocks';

const CONTAINER_CLASS = 'bg-gray-50 dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700';

const LANGUAGES = ['Plain text', 'JavaScript', 'TypeScript', 'Python', 'SQL', 'JSON', 'Bash', 'HTML', 'CSS'];

export function CodeView({ block }: { block: CodeBlock }) {
  return (
    <div className={CONTAINER_CLASS}>
      <div className="flex items-center justify-end px-2 py-1 border-b border-gray-200 dark:border-slate-700">
        <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400">{block.language}</span>
      </div>
      <pre className="p-3 overflow-x-auto">
        <code className="font-mono text-[13px] text-gray-800 dark:text-gray-200">{block.code || '// code'}</code>
      </pre>
    </div>
  );
}

export function CodeEditor({ block, onUpdate }: { block: CodeBlock; onUpdate: (b: CodeBlock) => void }) {
  return (
    <div className={CONTAINER_CLASS}>
      <div className="flex items-center justify-end px-2 py-1 border-b border-gray-200 dark:border-slate-700">
        <select
          value={block.language}
          onChange={(e) => onUpdate({ ...block, language: e.target.value })}
          className="text-[11px] font-bold bg-transparent focus:outline-none text-gray-500 dark:text-gray-400"
        >
          {LANGUAGES.map((lang) => (
            <option key={lang} value={lang}>{lang}</option>
          ))}
        </select>
      </div>
      <textarea
        value={block.code}
        onChange={(e) => onUpdate({ ...block, code: e.target.value })}
        className="w-full font-mono text-[13px] p-3 bg-transparent focus:outline-none resize-y text-gray-800 dark:text-gray-200"
        placeholder="// code"
        rows={4}
      />
    </div>
  );
}
