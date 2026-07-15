'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  Blocks,
  CheckCircle2,
  Clock,
  FolderOpen,
  Loader2,
  Play,
  Plus,
  Zap,
} from 'lucide-react';
import { Workflow, WorkflowRunDetail, workflowsApi } from '@/lib/api/workflows.api';

function formatDate(value?: string | null): string {
  if (!value) return 'Never';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function makeRunKey(workflowId: string): string {
  return `manual-${workflowId}-${Date.now()}`;
}

export default function AutomationsDashboard() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [latestRun, setLatestRun] = useState<WorkflowRunDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeCount = useMemo(() => workflows.filter((workflow) => workflow.status === 'active').length, [workflows]);
  const successfulCount = useMemo(
    () => workflows.filter((workflow) => workflow.last_run_status === 'succeeded').length,
    [workflows],
  );

  async function loadWorkflows() {
    setLoading(true);
    setError(null);
    try {
      setWorkflows(await workflowsApi.list());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load workflows');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadWorkflows();
  }, []);

  async function runNow(workflow: Workflow) {
    setRunningId(workflow.id);
    setError(null);
    try {
      const detail = await workflowsApi.manualRun(workflow.id, makeRunKey(workflow.id));
      setLatestRun(detail);
      await loadWorkflows();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Manual run failed');
    } finally {
      setRunningId(null);
    }
  }

  return (
    <div className="min-h-[calc(100vh-80px)] bg-gray-50/50 dark:bg-dark-bg text-gray-900 dark:text-gray-100 pb-12">
      <div className="max-w-7xl mx-auto px-4 lg:px-8 py-8 animate-fade-in">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 border-b border-gray-200 dark:border-dark-border pb-6">
          <div>
            <h1 className="text-3xl font-black text-gray-900 dark:text-white flex items-center gap-3">
              Workflow <span className="text-primary-600 dark:text-primary-400">Automations</span>
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/programs" className="flex items-center gap-2 bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border text-gray-900 dark:text-white px-5 py-3 rounded-lg font-bold shadow-sm transition hover:bg-gray-50 dark:hover:bg-slate-800 whitespace-nowrap">
              <Blocks className="w-5 h-5 text-primary-500" /> Mini Programs
            </Link>
            <Link href="/automations/builder" className="flex items-center gap-2 bg-primary-600 hover:bg-primary-500 text-white px-5 py-3 rounded-lg font-bold shadow-md transition whitespace-nowrap">
              <Plus className="w-5 h-5" /> Create Workflow
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white dark:bg-dark-card p-6 border border-gray-100 dark:border-dark-border shadow-sm">
            <div className="text-4xl font-black text-gray-900 dark:text-white mb-2">{workflows.length}</div>
            <div className="text-sm font-bold text-gray-500 uppercase">Persisted Workflows</div>
          </div>
          <div className="bg-white dark:bg-dark-card p-6 border border-gray-100 dark:border-dark-border shadow-sm">
            <div className="text-4xl font-black text-primary-600 dark:text-primary-400 mb-2">{activeCount}</div>
            <div className="text-sm font-bold text-gray-500 uppercase">Active</div>
          </div>
          <div className="bg-white dark:bg-dark-card p-6 border border-gray-100 dark:border-dark-border shadow-sm">
            <div className="text-4xl font-black text-green-500 mb-2">{successfulCount}</div>
            <div className="text-sm font-bold text-gray-500 uppercase">Succeeded Last Run</div>
          </div>
        </div>

        {error && (
          <div className="mb-6 border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 p-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5" /> {error}
          </div>
        )}

        {latestRun && (
          <div className="mb-6 bg-white dark:bg-dark-card border border-gray-100 dark:border-dark-border shadow-sm p-5">
            <div className="text-sm font-black text-gray-900 dark:text-white mb-3">Latest Manual Run</div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs font-semibold text-gray-600 dark:text-gray-300">
              <span>Status: {latestRun.run.status}</span>
              <span>Attempts: {latestRun.run.attempts}</span>
              <span>Correlation: {latestRun.run.correlation_id}</span>
              <span>Event: {latestRun.run.event_id}</span>
            </div>
            <div className="mt-3 divide-y divide-gray-100 dark:divide-dark-border">
              {latestRun.steps.map((step) => (
                <div key={step.id} className="py-2 text-xs text-gray-600 dark:text-gray-300">
                  {step.step_order}. {step.node_kind} - {step.status} - attempts {step.attempts}
                  {step.error_text ? ` - ${step.error_text}` : ''}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-dark-card border border-gray-100 dark:border-dark-border shadow-sm overflow-hidden flex flex-col">
          <div className="p-5 border-b border-gray-100 dark:border-dark-border flex items-center justify-between">
            <h2 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
              <FolderOpen className="w-5 h-5 text-gray-400" /> My Workflows
            </h2>
          </div>

          {loading ? (
            <div className="p-8 flex items-center gap-2 text-gray-500 font-semibold">
              <Loader2 className="w-5 h-5 animate-spin" /> Loading workflows
            </div>
          ) : workflows.length === 0 ? (
            <div className="p-8 text-gray-500 font-semibold">No workflows yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[760px]">
                <thead>
                  <tr className="bg-gray-50 dark:bg-slate-800/50 border-b border-gray-100 dark:border-dark-border text-xs uppercase text-gray-500 font-bold">
                    <th className="p-4 pl-6">Workflow Details</th>
                    <th className="p-4">Trigger Event</th>
                    <th className="p-4">Last Run</th>
                    <th className="p-4">Updated</th>
                    <th className="p-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-dark-border">
                  {workflows.map((workflow) => (
                    <tr key={workflow.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/30 transition-colors group">
                      <td className="p-4 pl-6">
                        <div className="flex items-center gap-3">
                          <div className={workflow.status === 'active' ? 'p-2 bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400' : 'p-2 bg-gray-100 dark:bg-slate-800 text-gray-400'}>
                            <Zap className="w-5 h-5" />
                          </div>
                          <div>
                            <Link href={`/automations/builder?id=${workflow.id}`} className="font-bold text-gray-900 dark:text-white hover:text-primary-600 dark:hover:text-primary-400 max-w-[280px] block truncate">
                              {workflow.name}
                            </Link>
                            <div className="text-xs text-gray-500 mt-0.5">v{workflow.version} - {workflow.status}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-sm font-semibold text-gray-600 dark:text-gray-300">Manual</td>
                      <td className="p-4">
                        <div className="flex items-center gap-1.5 text-sm font-medium text-gray-500">
                          {workflow.last_run_status === 'succeeded' ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Clock className="w-4 h-4" />}
                          {workflow.last_run_status ?? 'No runs'} - {formatDate(workflow.last_run_at)}
                        </div>
                      </td>
                      <td className="p-4 text-sm text-gray-500">{formatDate(workflow.updated_at)}</td>
                      <td className="p-4">
                        <button
                          onClick={() => void runNow(workflow)}
                          disabled={workflow.status !== 'active' || runningId === workflow.id}
                          className="text-xs font-bold text-gray-600 dark:text-gray-300 bg-white dark:bg-dark-bg border border-gray-200 dark:border-slate-700 hover:bg-gray-50 hover:text-gray-900 dark:hover:bg-slate-800 dark:hover:text-white transition px-3 py-1.5 rounded-lg flex items-center gap-1 whitespace-nowrap shadow-sm disabled:opacity-50"
                        >
                          {runningId === workflow.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                          Run Now
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
