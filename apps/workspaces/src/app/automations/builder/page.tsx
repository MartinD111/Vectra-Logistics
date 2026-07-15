'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import WorkflowBuilder, { builderGraphFromState, WorkflowNode } from '@/components/automations/WorkflowBuilder';
import Link from 'next/link';
import { AlertCircle, ArrowLeft, CheckCircle2, Loader2, Play, Save } from 'lucide-react';
import { Workflow, workflowsApi } from '@/lib/api/workflows.api';

export default function WorkflowBuilderPage() {
  const params = useSearchParams();
  const workflowId = params.get('id');
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [workflowName, setWorkflowName] = useState('Untitled Workflow');
  const [nodes, setNodes] = useState<WorkflowNode[]>([]);
  const [loading, setLoading] = useState(!!workflowId);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!workflowId) {
      setLoading(false);
      return;
    }

    const id = workflowId;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const loaded = await workflowsApi.get(id);
        setWorkflow(loaded);
        setWorkflowName(loaded.name);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load workflow');
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [workflowId]);

  async function saveDraft(): Promise<Workflow | null> {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const graph = builderGraphFromState(nodes);
      const saved = workflow
        ? await workflowsApi.update(workflow.id, { name: workflowName, graph })
        : await workflowsApi.create({ name: workflowName, graph });
      setWorkflow(saved);
      setMessage('Draft saved');
      return saved;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save workflow');
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function publish() {
    setPublishing(true);
    setError(null);
    setMessage(null);
    try {
      const saved = await saveDraft();
      if (!saved) return;
      const published = await workflowsApi.publish(saved.id);
      setWorkflow(published);
      setMessage('Workflow published and ready for manual runs');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to publish workflow');
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-dark-bg text-gray-900 dark:text-gray-100 flex flex-col">
      <div className="h-16 bg-white dark:bg-dark-card border-b border-gray-200 dark:border-dark-border flex items-center justify-between px-4 lg:px-6 shadow-sm z-10 relative">
        <div className="flex items-center gap-4 min-w-0">
          <Link href="/automations" className="p-2 text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="h-6 w-px bg-gray-200 dark:bg-dark-border"></div>
          <input
            type="text"
            value={workflowName}
            onChange={(event) => setWorkflowName(event.target.value)}
            className="font-black text-lg text-gray-900 dark:text-white bg-transparent border-0 focus:ring-0 p-0 w-56 md:w-96 placeholder:text-gray-300"
            placeholder="Name your automation..."
          />
        </div>
        <div className="flex items-center gap-3">
          {message && <span className="hidden md:flex items-center gap-1 text-xs font-bold text-green-600"><CheckCircle2 className="w-4 h-4" /> {message}</span>}
          {error && <span className="hidden lg:flex items-center gap-1 text-xs font-bold text-red-600"><AlertCircle className="w-4 h-4" /> {error}</span>}
          <button
            onClick={() => void saveDraft()}
            disabled={saving || loading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-bold bg-white dark:bg-dark-card text-gray-900 dark:text-white border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-lg transition shadow-sm disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
          </button>
          <button
            onClick={() => void publish()}
            disabled={publishing || loading}
            className="flex items-center gap-2 px-5 py-2 text-sm font-bold bg-primary-600 text-white rounded-lg hover:bg-primary-500 shadow-md transition disabled:opacity-50"
          >
            {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />} Publish
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 grid place-items-center text-gray-500 font-semibold">
          <span className="flex items-center gap-2"><Loader2 className="w-5 h-5 animate-spin" /> Loading workflow</span>
        </div>
      ) : (
        <div className="flex-1 relative overflow-hidden flex">
          <WorkflowBuilder workflow={workflow} nodes={nodes} onNodesChange={setNodes} />
        </div>
      )}
    </div>
  );
}
