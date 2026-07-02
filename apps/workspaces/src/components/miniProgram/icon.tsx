'use client';

// Resolve a lucide icon by name (block registry stores names as strings so configs
// stay plain JSON). Unknown names fall back to a neutral square.
import {
  UploadCloud, ClipboardPaste, TextCursorInput, Columns, Wand2, Table2, Download,
  Copy, FileText, ListChecks, Type, Square, type LucideIcon,
} from 'lucide-react';

const MAP: Record<string, LucideIcon> = {
  UploadCloud, ClipboardPaste, TextCursorInput, Columns, Wand2, Table2, Download,
  Copy, FileText, ListChecks, Type,
};

export function BlockIcon({ name, className }: { name?: string; className?: string }) {
  const Cmp = (name && MAP[name]) || Square;
  return <Cmp className={className} />;
}
