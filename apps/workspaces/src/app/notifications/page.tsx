'use client';

import Link from 'next/link';
import { Bell, Check, CheckCheck, Loader2 } from 'lucide-react';
import {
  useMarkAllRead, useMarkNotificationRead, useNotifications,
} from '@vectra/data';

function fmt(iso: string) {
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

export default function NotificationsPage() {
  const { data, isLoading, error } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllRead();

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
            <Bell className="w-5 h-5 text-primary-600 dark:text-primary-400" />
          </div>
          <h1 className="text-2xl font-bold dark:text-white">Notifications</h1>
        </div>
        <button
          onClick={() => markAll.mutate()}
          disabled={markAll.isPending}
          className="inline-flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-sm font-semibold rounded-xl border border-slate-200 dark:border-slate-600 disabled:opacity-50"
        >
          <CheckCheck className="w-4 h-4" /> Mark all read
        </button>
      </div>

      {isLoading && <p className="text-slate-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</p>}
      {error && <p className="text-red-500">Failed to load notifications.</p>}
      {data && data.length === 0 && (
        <div className="saas-card text-center py-12 text-slate-500">
          No notifications yet.
        </div>
      )}

      <ul className="space-y-2">
        {data?.map((n) => {
          const inner = (
            <div className={`saas-card flex items-start gap-3 hover:shadow-md transition-shadow ${!n.is_read ? 'border-primary-300 dark:border-primary-700' : ''}`}>
              <div className={`w-2 h-2 mt-2 rounded-full flex-shrink-0 ${n.is_read ? 'bg-slate-300 dark:bg-slate-600' : 'bg-primary-500'}`} />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-800 dark:text-white">{n.title}</p>
                {n.body && <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">{n.body}</p>}
                <p className="text-xs text-slate-500 mt-2">{fmt(n.created_at)}</p>
              </div>
              {!n.is_read && (
                <button
                  onClick={(e) => { e.preventDefault(); markRead.mutate(n.id); }}
                  className="p-1.5 text-slate-400 hover:text-primary-600 rounded-lg"
                  title="Mark read"
                >
                  <Check className="w-4 h-4" />
                </button>
              )}
            </div>
          );
          return (
            <li key={n.id}>
              {n.link ? (
                <Link href={n.link} onClick={() => { if (!n.is_read) markRead.mutate(n.id); }}>{inner}</Link>
              ) : inner}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
