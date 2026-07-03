'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Gauge, Plus, Loader2, Trash2, Play, Info } from 'lucide-react';
import {
  useKpiRules, useKpiSummary, useCreateKpiRule, useDeleteKpiRule, useRunKpiEvaluation,
} from '@/lib/hooks/useKpi';
import { useProjects } from '@/lib/hooks/useProjects';
import { useTeam } from '@/lib/hooks/useTeam';
import { SOURCE_TYPES, type KpiSourceType, type CreateKpiRuleInput } from '@/lib/api/kpi.api';

const SOURCE_LABELS: Record<KpiSourceType, { label: string; description: string; computable: boolean }> = {
  outlook_calendar: {
    label: 'Outlook workday %',
    description: 'Actual % of the workday spent on the project vs. the planned % from project assignments.',
    computable: false,
  },
  activity_volume: {
    label: 'Activity volume',
    description: 'Count of recorded activity events for the member vs. a target threshold.',
    computable: true,
  },
  task_completion: {
    label: 'Task completion rate',
    description: '% of assigned tasks completed vs. total assigned.',
    computable: false,
  },
  on_time_delivery: {
    label: 'On-time delivery',
    description: '% of deliverables completed by their deadline.',
    computable: false,
  },
  response_time: {
    label: 'Response time SLA',
    description: 'Average time between a trigger event and the member\'s response, vs. an SLA threshold.',
    computable: false,
  },
  project_value: {
    label: 'Project value attribution',
    description: 'Revenue/value attributed to a project, apportioned to assigned members by planned %.',
    computable: false,
  },
};

export default function TeamKpisPage() {
  const { data: rules, isLoading } = useKpiRules();
  const { data: summary } = useKpiSummary();
  const { data: projects } = useProjects();
  const { data: members } = useTeam();
  const createRule = useCreateKpiRule();
  const deleteRule = useDeleteKpiRule();
  const runEvaluation = useRunKpiEvaluation();

  const [open, setOpen] = useState(false);

  const projectName = (id: string | null) => projects?.find((p) => p.id === id)?.name ?? '—';
  const memberName = (id: string) => {
    const m = members?.find((m) => m.id === id);
    return m ? `${m.first_name} ${m.last_name}` : id;
  };

  async function runNow() {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    await runEvaluation.mutateAsync({ periodStart: start.toISOString(), periodEnd: now.toISOString() });
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-gray-50/50 dark:bg-dark-bg">
      <div className="max-w-5xl mx-auto px-4 lg:px-8 py-8">
        <Link href="/team" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to Team
        </Link>

        <div className="mb-8 flex items-end justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
              <Gauge className="w-7 h-7 text-primary-500" /> Team KPIs
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Define rules for how the platform tracks performance per employee and project.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={runNow} disabled={runEvaluation.isPending}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-200 text-sm font-semibold hover:bg-gray-50 dark:hover:bg-slate-800 disabled:opacity-60">
              {runEvaluation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Run evaluation (this month)
            </button>
            <button onClick={() => setOpen((v) => !v)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-sm font-semibold">
              <Plus className="w-4 h-4" /> New rule
            </button>
          </div>
        </div>

        {open && (
          <RuleBuilderForm
            projects={projects ?? []}
            members={members ?? []}
            onCancel={() => setOpen(false)}
            onSubmit={async (data) => { await createRule.mutateAsync(data); setOpen(false); }}
            submitting={createRule.isPending}
          />
        )}

        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-3">Rules</h2>
        {isLoading ? (
          <div className="flex items-center gap-2 text-gray-400 py-10 justify-center">
            <Loader2 className="w-5 h-5 animate-spin" /> Loading…
          </div>
        ) : (rules ?? []).length === 0 ? (
          <div className="saas-card text-center py-10 text-sm text-gray-500 mb-8">
            No KPI rules yet. Create one to start tracking performance.
          </div>
        ) : (
          <div className="space-y-2 mb-8">
            {(rules ?? []).map((r) => {
              const meta = SOURCE_LABELS[r.source_type];
              return (
                <div key={r.id} className="saas-card !py-3 flex items-center gap-4 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-900 dark:text-white truncate">{r.name}</p>
                    <p className="text-xs text-gray-500 truncate">
                      {meta.label} · {r.target_project_id ? projectName(r.target_project_id) : 'All projects'}
                      {!meta.computable && <span className="ml-1.5 text-amber-600 dark:text-amber-400">(not yet computed)</span>}
                    </p>
                  </div>
                  {!r.is_active && <span className="text-xs text-gray-400">Inactive</span>}
                  <button onClick={() => deleteRule.mutate(r.id)} className="p-2 text-gray-400 hover:text-red-500">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-3">Results</h2>
        {(summary ?? []).length === 0 ? (
          <div className="saas-card text-center py-10 text-sm text-gray-500 flex flex-col items-center gap-2">
            <Info className="w-5 h-5 text-gray-300" />
            No results yet. Create a rule and run an evaluation.
          </div>
        ) : (
          <div className="saas-card !p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-gray-500 border-b border-gray-100 dark:border-dark-border">
                  <th className="p-3">Member</th>
                  <th className="p-3">Rule</th>
                  <th className="p-3">Actual</th>
                  <th className="p-3">Target</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-dark-border">
                {(summary ?? []).map((r) => (
                  <tr key={r.id}>
                    <td className="p-3 font-medium text-gray-900 dark:text-white">{memberName(r.user_id)}</td>
                    <td className="p-3 text-gray-600 dark:text-gray-300">{r.rule_name}</td>
                    <td className="p-3">{r.actual_value ?? '—'}</td>
                    <td className="p-3">{r.target_value ?? '—'}</td>
                    <td className="p-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        r.status === 'computed' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : r.status === 'unavailable' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function RuleBuilderForm({
  projects, members, onCancel, onSubmit, submitting,
}: {
  projects: { id: string; name: string }[];
  members: { id: string; first_name: string; last_name: string }[];
  onCancel: () => void;
  onSubmit: (data: CreateKpiRuleInput) => Promise<void>;
  submitting: boolean;
}) {
  const [name, setName] = useState('');
  const [sourceType, setSourceType] = useState<KpiSourceType>('activity_volume');
  const [targetProjectId, setTargetProjectId] = useState('');
  const [targetUserId, setTargetUserId] = useState('');
  const [threshold, setThreshold] = useState(10);
  const [weight, setWeight] = useState(1);

  const meta = SOURCE_LABELS[sourceType];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await onSubmit({
      name: name.trim(),
      source_type: sourceType,
      target_project_id: targetProjectId || null,
      target_user_id: targetUserId || null,
      threshold,
      weight,
      condition: sourceType === 'outlook_calendar' ? { basis: 'planned_vs_actual_workday' } : {},
    });
  }

  return (
    <form onSubmit={submit} className="saas-card mb-8 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label><span className="label-xs">Rule name</span>
          <input className="saas-input" value={name} autoFocus required
            onChange={(e) => setName(e.target.value)} placeholder="e.g. Workday allocation — Q3 Import Project" /></label>
        <label><span className="label-xs">Rule type</span>
          <select className="saas-input" value={sourceType} onChange={(e) => setSourceType(e.target.value as KpiSourceType)}>
            {SOURCE_TYPES.map((t) => <option key={t} value={t}>{SOURCE_LABELS[t].label}</option>)}
          </select></label>
        <label><span className="label-xs">Target project (optional)</span>
          <select className="saas-input" value={targetProjectId} onChange={(e) => setTargetProjectId(e.target.value)}>
            <option value="">All projects</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select></label>
        <label><span className="label-xs">Target member (optional)</span>
          <select className="saas-input" value={targetUserId} onChange={(e) => setTargetUserId(e.target.value)}>
            <option value="">All assigned members</option>
            {members.map((m) => <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>)}
          </select></label>
        <label><span className="label-xs">Threshold</span>
          <input type="number" className="saas-input" value={threshold} min={0} max={100}
            onChange={(e) => setThreshold(Number(e.target.value))} /></label>
        <label><span className="label-xs">Weight</span>
          <input type="number" className="saas-input" value={weight} min={0} max={100}
            onChange={(e) => setWeight(Number(e.target.value))} /></label>
      </div>
      <p className="text-xs text-gray-500 flex items-start gap-1.5">
        <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {meta.description}
        {!meta.computable && ' This rule type is not computed automatically yet — evaluations will show as "unavailable" until it ships.'}
      </p>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={submitting || !name.trim()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-500 disabled:opacity-60 text-white text-sm font-semibold">
          {submitting && <Loader2 className="w-4 h-4 animate-spin" />} Create rule
        </button>
        <button type="button" onClick={onCancel} className="text-sm text-gray-500 hover:text-gray-700">Cancel</button>
      </div>
    </form>
  );
}
