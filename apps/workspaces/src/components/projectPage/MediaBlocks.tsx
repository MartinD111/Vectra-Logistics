'use client';

// URL-only media blocks — image, file, video, bookmark, embed (CONT-05).
// Zero backend surface: no server-side fetch/scrape of any pasted URL
// (D-05/D-06 discretion). The browser resolves <img>/<video>/<iframe> src
// directly; bookmark/embed render a static hostname card built entirely
// client-side from the URL string.

import { useEffect, useRef, useState } from 'react';
import { Image, File, Play, Bookmark, Frame, type LucideIcon } from 'lucide-react';
import type {
  ImageBlock, FileBlock, VideoBlock, BookmarkBlock, EmbedBlock,
} from '@/lib/projectPage/blocks';

type UrlBlock = ImageBlock | FileBlock | VideoBlock | BookmarkBlock | EmbedBlock;

function isValidUrl(value: string): boolean {
  try {
    // eslint-disable-next-line no-new
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function UrlInputCard({
  icon: Icon,
  onSubmit,
}: {
  icon: LucideIcon;
  onSubmit: (url: string) => void;
}) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const commit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    if (!isValidUrl(trimmed)) {
      setError("That doesn't look like a valid link — check the URL and try again.");
      return;
    }
    setError(null);
    onSubmit(trimmed);
  };

  return (
    <div className="border-2 border-dashed border-gray-300 dark:border-slate-700 rounded-xl p-4">
      <div className="flex flex-col items-center gap-2">
        <Icon className="w-5 h-5 text-gray-400" />
        <input
          type="url"
          value={value}
          onChange={(e) => { setValue(e.target.value); setError(null); }}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } }}
          placeholder="Paste a link or drop a file"
          className="w-full max-w-sm rounded-md border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    </div>
  );
}

function Caption({
  value,
  onCommit,
}: {
  value: string;
  onCommit: (next: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || document.activeElement === el) return;
    if ((el.textContent ?? '') !== value) el.textContent = value;
  }, [value]);

  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      className="mt-1.5 text-xs text-gray-400 focus:outline-none"
      data-placeholder="Add a caption…"
      onBlur={() => {
        const next = (ref.current?.textContent ?? '').trim();
        if (next !== value) onCommit(next);
      }}
    />
  );
}

function ChangeUrlButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="mt-1.5 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
    >
      Change URL
    </button>
  );
}

function basename(url: string): string {
  try {
    const u = new URL(url);
    const segments = u.pathname.split('/').filter(Boolean);
    return segments[segments.length - 1] || url;
  } catch {
    return url;
  }
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'youtu.be']);
const VIMEO_HOSTS = new Set(['vimeo.com', 'www.vimeo.com']);

function videoEmbedSrc(url: string): string | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const host = u.hostname;
  if (YOUTUBE_HOSTS.has(host)) {
    let id = u.searchParams.get('v');
    if (!id && host === 'youtu.be') {
      id = u.pathname.split('/').filter(Boolean)[0] ?? null;
    }
    return id ? `https://www.youtube.com/embed/${id}` : null;
  }
  if (VIMEO_HOSTS.has(host)) {
    const id = u.pathname.split('/').filter(Boolean)[0];
    return id && /^\d+$/.test(id) ? `https://player.vimeo.com/video/${id}` : null;
  }
  return null;
}

// ── Image ──────────────────────────────────────────────────────────────────

export function ImageBlockView({ block }: { block: ImageBlock }) {
  if (!block.url) return <UrlInputCard icon={Image} onSubmit={() => {}} />;
  return (
    <div>
      <img src={block.url} alt={block.caption ?? ''} className="max-w-full rounded-lg" />
      {block.caption && <p className="mt-1.5 text-xs text-gray-400">{block.caption}</p>}
    </div>
  );
}

export function ImageBlockEditor({ block, onUpdate }: { block: ImageBlock; onUpdate: (b: ImageBlock) => void }) {
  if (!block.url) {
    return <UrlInputCard icon={Image} onSubmit={(url) => onUpdate({ ...block, url })} />;
  }
  return (
    <div>
      <img src={block.url} alt={block.caption ?? ''} className="max-w-full rounded-lg" />
      <Caption value={block.caption ?? ''} onCommit={(caption) => onUpdate({ ...block, caption })} />
      <ChangeUrlButton onClick={() => onUpdate({ ...block, url: '' })} />
    </div>
  );
}

// ── File ───────────────────────────────────────────────────────────────────

function FileRow({ url }: { url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-slate-700 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800/60"
    >
      <File className="w-4 h-4 text-gray-400 shrink-0" />
      <span className="truncate">{basename(url)}</span>
    </a>
  );
}

export function FileBlockView({ block }: { block: FileBlock }) {
  if (!block.url) return <UrlInputCard icon={File} onSubmit={() => {}} />;
  return (
    <div>
      <FileRow url={block.url} />
      {block.caption && <p className="mt-1.5 text-xs text-gray-400">{block.caption}</p>}
    </div>
  );
}

export function FileBlockEditor({ block, onUpdate }: { block: FileBlock; onUpdate: (b: FileBlock) => void }) {
  if (!block.url) {
    return <UrlInputCard icon={File} onSubmit={(url) => onUpdate({ ...block, url })} />;
  }
  return (
    <div>
      <FileRow url={block.url} />
      <Caption value={block.caption ?? ''} onCommit={(caption) => onUpdate({ ...block, caption })} />
      <ChangeUrlButton onClick={() => onUpdate({ ...block, url: '' })} />
    </div>
  );
}

// ── Video ──────────────────────────────────────────────────────────────────

function VideoPlayer({ url }: { url: string }) {
  const embedSrc = videoEmbedSrc(url);
  if (embedSrc) {
    return (
      <div className="relative pt-[56.25%] rounded-lg overflow-hidden">
        <iframe
          src={embedSrc}
          className="absolute inset-0 w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }
  return <video src={url} controls className="max-w-full rounded-lg" />;
}

export function VideoBlockView({ block }: { block: VideoBlock }) {
  if (!block.url) return <UrlInputCard icon={Play} onSubmit={() => {}} />;
  return (
    <div>
      <VideoPlayer url={block.url} />
      {block.caption && <p className="mt-1.5 text-xs text-gray-400">{block.caption}</p>}
    </div>
  );
}

export function VideoBlockEditor({ block, onUpdate }: { block: VideoBlock; onUpdate: (b: VideoBlock) => void }) {
  if (!block.url) {
    return <UrlInputCard icon={Play} onSubmit={(url) => onUpdate({ ...block, url })} />;
  }
  return (
    <div>
      <VideoPlayer url={block.url} />
      <Caption value={block.caption ?? ''} onCommit={(caption) => onUpdate({ ...block, caption })} />
      <ChangeUrlButton onClick={() => onUpdate({ ...block, url: '' })} />
    </div>
  );
}

// ── Bookmark / Embed (no server-side scraping — D-06) ───────────────────────

function LinkCard({ icon: Icon, url }: { icon: LucideIcon; url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-slate-700 px-3 py-2 hover:bg-gray-50 dark:hover:bg-slate-800/60"
    >
      <Icon className="w-4 h-4 text-gray-400 shrink-0" />
      <div className="min-w-0">
        <div className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">{hostname(url)}</div>
        <div className="text-xs text-gray-400 truncate">{url}</div>
      </div>
    </a>
  );
}

export function BookmarkBlockView({ block }: { block: BookmarkBlock }) {
  if (!block.url) return <UrlInputCard icon={Bookmark} onSubmit={() => {}} />;
  return (
    <div>
      <LinkCard icon={Bookmark} url={block.url} />
      {block.caption && <p className="mt-1.5 text-xs text-gray-400">{block.caption}</p>}
    </div>
  );
}

export function BookmarkBlockEditor({ block, onUpdate }: { block: BookmarkBlock; onUpdate: (b: BookmarkBlock) => void }) {
  if (!block.url) {
    return <UrlInputCard icon={Bookmark} onSubmit={(url) => onUpdate({ ...block, url })} />;
  }
  return (
    <div>
      <LinkCard icon={Bookmark} url={block.url} />
      <Caption value={block.caption ?? ''} onCommit={(caption) => onUpdate({ ...block, caption })} />
      <ChangeUrlButton onClick={() => onUpdate({ ...block, url: '' })} />
    </div>
  );
}

export function EmbedBlockView({ block }: { block: EmbedBlock }) {
  if (!block.url) return <UrlInputCard icon={Frame} onSubmit={() => {}} />;
  return (
    <div>
      <LinkCard icon={Frame} url={block.url} />
      {block.caption && <p className="mt-1.5 text-xs text-gray-400">{block.caption}</p>}
    </div>
  );
}

export function EmbedBlockEditor({ block, onUpdate }: { block: EmbedBlock; onUpdate: (b: EmbedBlock) => void }) {
  if (!block.url) {
    return <UrlInputCard icon={Frame} onSubmit={(url) => onUpdate({ ...block, url })} />;
  }
  return (
    <div>
      <LinkCard icon={Frame} url={block.url} />
      <Caption value={block.caption ?? ''} onCommit={(caption) => onUpdate({ ...block, caption })} />
      <ChangeUrlButton onClick={() => onUpdate({ ...block, url: '' })} />
    </div>
  );
}
