'use client';

import { useState } from 'react';
import {
  Users, Plus, Loader2, Activity, Clock, Trash2, ShieldCheck, X, BarChart3,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import {
  useTeam, useAddMember, useUpdateMemberRole, useRemoveMember, useMemberStats,
} from '@/lib/hooks/useTeam';
import type { TeamMember } from '@/lib/api/team.api';

const ROLE_BADGE: Record<string, string> = {
  admin: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  carrier: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  shipper: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
};

function timeAgo(iso: string | null): string {
  if (!iso) return 'never';
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function TeamPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { data: members, isLoading } = useTeam();
  const addMember = useAddMember();
  const updateRole = useUpdateMemberRole();
  const removeMember = useRemoveMember();

  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<TeamMember | null>(null);
  const [form, setForm] = useState({ email: '', first_name: '', last_name: '', role: 'carrier', password: '' });
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await addMember.mutateAsync({ ...form, role: form.role as 'carrier' | 'shipper' | 'admin' });
      setForm({ email: '', first_name: '', last_name: '', role: 'carrier', password: '' });
      setOpen(false);
    } catch (err: any) {
      setError(err.message ?? 'Could not add member');
    }
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-gray-50/50 dark:bg-dark-bg">
      <div className="max-w-5xl mx-auto px-4 lg:px-8 py-8">
        <div className="mb-8 flex items-end justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
              <Users className="w-7 h-7 text-primary-500" /> Team
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Company members and their activity. {isAdmin ? 'Add members and manage roles.' : ''}
            </p>
          </div>
          {isAdmin && (
            <button onClick={() => setOpen((v) => !v)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-sm font-semibold">
              <Plus className="w-4 h-4" /> Add member
            </button>
          )}
        </div>

        {isAdmin && open && (
          <form onSubmit={submit} className="saas-card mb-8 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label><span className="label-xs">First name</span>
                <input className="saas-input" value={form.first_name} required
                  onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))} /></label>
              <label><span className="label-xs">Last name</span>
                <input className="saas-input" value={form.last_name} required
                  onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))} /></label>
              <label><span className="label-xs">Email</span>
                <input className="saas-input" type="email" value={form.email} required
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} /></label>
              <label><span className="label-xs">Role</span>
                <select className="saas-input" value={form.role}
                  onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
                  <option value="carrier">Carrier</option>
                  <option value="shipper">Shipper</option>
                  <option value="admin">Admin</option>
                </select></label>
              <label className="sm:col-span-2"><span className="label-xs">Initial password (share with the member)</span>
                <input className="saas-input" type="text" value={form.password} required minLength={8}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder="min 8 characters" /></label>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex items-center gap-3">
              <button type="submit" disabled={addMember.isPending}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-500 disabled:opacity-60 text-white text-sm font-semibold">
                {addMember.isPending && <Loader2 className="w-4 h-4 animate-spin" />} Add member
              </button>
              <button type="button" onClick={() => setOpen(false)} className="text-sm text-gray-500 hover:text-gray-700">Cancel</button>
            </div>
          </form>
        )}

        {isLoading ? (
          <div className="flex items-center gap-2 text-gray-400 py-16 justify-center">
            <Loader2 className="w-5 h-5 animate-spin" /> Loading team…
          </div>
        ) : (
          <div className="space-y-2">
            {(members ?? []).map((m) => (
              <div key={m.id} className="saas-card !py-3 flex items-center gap-4 flex-wrap">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-sm font-black flex-shrink-0">
                  {m.first_name[0]}{m.last_name[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-gray-900 dark:text-white truncate">
                    {m.first_name} {m.last_name}
                    {m.id === user?.id && <span className="ml-2 text-xs text-gray-400">(you)</span>}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{m.email}</p>
                </div>

                {/* Per-user activity KPIs */}
                <div className="hidden sm:flex items-center gap-5 text-center">
                  <div><p className="text-sm font-bold text-gray-900 dark:text-white">{m.total_events}</p><p className="text-[10px] text-gray-400 uppercase">events</p></div>
                  <div><p className="text-sm font-bold text-gray-900 dark:text-white">{m.events_last_7d}</p><p className="text-[10px] text-gray-400 uppercase">7 days</p></div>
                  <div className="text-xs text-gray-400 inline-flex items-center gap-1"><Clock className="w-3 h-3" /> {timeAgo(m.last_activity_at)}</div>
                </div>

                {/* Role */}
                {isAdmin && m.id !== user?.id ? (
                  <select value={m.role} onChange={(e) => updateRole.mutate({ id: m.id, role: e.target.value })}
                    className={`text-xs font-semibold rounded-full px-2 py-1 border-0 focus:ring-2 focus:ring-primary-500 ${ROLE_BADGE[m.role] ?? 'bg-gray-100 text-gray-600'}`}>
                    <option value="carrier">carrier</option>
                    <option value="shipper">shipper</option>
                    <option value="admin">admin</option>
                  </select>
                ) : (
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize inline-flex items-center gap-1 ${ROLE_BADGE[m.role] ?? 'bg-gray-100 text-gray-600'}`}>
                    {m.role === 'admin' && <ShieldCheck className="w-3 h-3" />}{m.role}
                  </span>
                )}

                <button onClick={() => setSelected(m)} title="View KPIs"
                  className="p-2 text-gray-400 hover:text-primary-600"><BarChart3 className="w-4 h-4" /></button>

                {isAdmin && m.id !== user?.id && (
                  <button onClick={() => { if (confirm(`Remove ${m.first_name}?`)) removeMember.mutate(m.id); }}
                    title="Remove" className="p-2 text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Per-user KPI drawer */}
      {selected && <MemberStatsDrawer member={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function MemberStatsDrawer({ member, onClose }: { member: TeamMember; onClose: () => void }) {
  const { data: stats, isLoading } = useMemberStats(member.id);
  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <div className="relative w-full max-w-md bg-white dark:bg-dark-bg h-full shadow-2xl p-6 overflow-y-auto animate-fade-in"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-black">
              {member.first_name[0]}{member.last_name[0]}
            </div>
            <div>
              <h2 className="font-bold text-gray-900 dark:text-white">{member.first_name} {member.last_name}</h2>
              <p className="text-xs text-gray-500">{member.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-gray-400 py-10 justify-center"><Loader2 className="w-5 h-5 animate-spin" /> Loading…</div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="saas-card !p-4">
                <div className="flex items-center gap-2 mb-1"><Activity className="w-4 h-4 text-violet-500" /><span className="text-xs text-gray-400 uppercase">Total events</span></div>
                <p className="text-2xl font-black text-gray-900 dark:text-white">{stats?.total_events ?? 0}</p>
              </div>
              <div className="saas-card !p-4">
                <div className="flex items-center gap-2 mb-1"><Clock className="w-4 h-4 text-amber-500" /><span className="text-xs text-gray-400 uppercase">Last 7 days</span></div>
                <p className="text-2xl font-black text-gray-900 dark:text-white">{stats?.events_last_7d ?? 0}</p>
              </div>
            </div>
            <p className="text-xs text-gray-400 mb-4">Last active: {timeAgo(stats?.last_activity_at ?? null)}</p>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-2">Activity breakdown</h3>
            {(stats?.by_verb ?? []).length === 0 ? (
              <p className="text-sm text-gray-400">No recorded activity yet.</p>
            ) : (
              <div className="space-y-1.5">
                {stats!.by_verb.map((v) => (
                  <div key={v.verb} className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-300 font-mono text-xs">{v.verb}</span>
                    <span className="font-semibold text-gray-900 dark:text-white">{v.count}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
