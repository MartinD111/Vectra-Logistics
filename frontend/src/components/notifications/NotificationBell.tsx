'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Bell, Check, CheckCheck } from 'lucide-react';
import {
  useMarkAllRead, useMarkNotificationRead, useNotifications, useUnreadCount,
} from '@/lib/hooks/useNotifications';

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { data: list } = useNotifications();
  const { data: counter } = useUnreadCount();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllRead();

  const unread = counter?.count ?? 0;
  const items = list ?? [];

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition focus:outline-none focus:ring-2 focus:ring-primary-500"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5 text-slate-600 dark:text-slate-300" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-96 max-h-[70vh] rounded-xl bg-white dark:bg-dark-card shadow-lg border border-gray-100 dark:border-dark-border z-50 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-dark-border">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Notifications</h3>
            {unread > 0 && (
              <button
                onClick={() => markAll.mutate()}
                disabled={markAll.isPending}
                className="text-xs text-primary-600 dark:text-primary-400 hover:underline font-semibold flex items-center gap-1"
              >
                <CheckCheck className="w-3.5 h-3.5" /> Mark all read
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {items.length === 0 && (
              <p className="text-center text-sm text-slate-500 py-10">No notifications yet.</p>
            )}
            <ul className="divide-y divide-gray-100 dark:divide-dark-border">
              {items.slice(0, 12).map((n) => {
                const content = (
                  <div className={`px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors ${!n.is_read ? 'bg-primary-50/40 dark:bg-primary-900/10' : ''}`}>
                    <div className="flex items-start gap-2">
                      <div className={`w-2 h-2 mt-1.5 rounded-full flex-shrink-0 ${n.is_read ? 'bg-transparent' : 'bg-primary-500'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 dark:text-white">{n.title}</p>
                        {n.body && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{n.body}</p>}
                        <p className="text-[10px] text-slate-400 mt-1">{timeAgo(n.created_at)}</p>
                      </div>
                      {!n.is_read && (
                        <button
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); markRead.mutate(n.id); }}
                          className="text-slate-400 hover:text-primary-600 transition-colors"
                          title="Mark read"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
                return (
                  <li key={n.id}>
                    {n.link ? (
                      <Link href={n.link} onClick={() => { setOpen(false); if (!n.is_read) markRead.mutate(n.id); }}>
                        {content}
                      </Link>
                    ) : content}
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="border-t border-gray-100 dark:border-dark-border px-4 py-2.5 text-center">
            <Link href="/notifications" onClick={() => setOpen(false)} className="text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline">
              View all notifications →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
