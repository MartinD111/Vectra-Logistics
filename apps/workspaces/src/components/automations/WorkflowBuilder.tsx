'use client';

import { useEffect, useState } from 'react';
import NodeSidebar from '@/components/automations/NodeSidebar';
import { Workflow, WorkflowGraphV1 } from '@/lib/api/workflows.api';
import {
  ArrowDown,
  Bell,
  LucideIcon,
  MoreHorizontal,
  Plus,
  Settings,
  X,
  Zap,
} from 'lucide-react';

export type NodeType = 'trigger' | 'action';
export type WorkflowNodeKind = 'trigger.manual' | 'action.notification.create';

export interface WorkflowNode {
  id: string;
  type: NodeType;
  kind: WorkflowNodeKind;
  title: string;
  description: string;
  icon: LucideIcon;
  iconColor: string;
  iconBg: string;
  config: {
    title?: string;
    body?: string;
    target?: 'self';
  };
}

const defaultNodes: WorkflowNode[] = [
  {
    id: 'trigger-1',
    type: 'trigger',
    kind: 'trigger.manual',
    title: 'Manual Trigger',
    description: 'Runs when a dispatcher clicks Run Now.',
    icon: Zap,
    iconColor: 'text-yellow-500',
    iconBg: 'bg-yellow-100 dark:bg-yellow-900/30',
    config: {},
  },
  {
    id: 'notify-1',
    type: 'action',
    kind: 'action.notification.create',
    title: 'Create Notification',
    description: 'Sends an in-app notification to the current user.',
    icon: Bell,
    iconColor: 'text-blue-500',
    iconBg: 'bg-blue-100 dark:bg-blue-900/30',
    config: { title: 'Workflow ran', body: 'Manual workflow completed.', target: 'self' },
  },
];

export function nodesFromWorkflow(workflow: Workflow | null): WorkflowNode[] {
  if (!workflow) return defaultNodes;
  const action = workflow.graph.nodes.find((node) => node.kind === 'action.notification.create');
  return defaultNodes.map((node) => {
    if (node.kind !== 'action.notification.create' || !action || action.kind !== 'action.notification.create') {
      return node;
    }
    return {
      ...node,
      id: action.id,
      config: action.config,
    };
  });
}

export function builderGraphFromState(nodes: WorkflowNode[]): WorkflowGraphV1 {
  const trigger = nodes.find((node) => node.kind === 'trigger.manual') ?? defaultNodes[0];
  const action = nodes.find((node) => node.kind === 'action.notification.create') ?? defaultNodes[1];
  return {
    version: 1,
    nodes: [
      { id: trigger.id, kind: 'trigger.manual', config: {} },
      {
        id: action.id,
        kind: 'action.notification.create',
        config: {
          title: action.config.title || 'Workflow ran',
          body: action.config.body || undefined,
          target: 'self',
        },
      },
    ],
    edges: [{ from: trigger.id, to: action.id }],
  };
}

interface Props {
  workflow: Workflow | null;
  nodes: WorkflowNode[];
  onNodesChange: (nodes: WorkflowNode[]) => void;
}

export default function WorkflowBuilder({ workflow, nodes, onNodesChange }: Props) {
  const [selectedNode, setSelectedNode] = useState<string | null>('notify-1');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  useEffect(() => {
    onNodesChange(nodesFromWorkflow(workflow));
  }, [workflow, onNodesChange]);

  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      .custom-grid-pattern {
        background-image: radial-gradient(circle, #e2e8f0 1px, transparent 1px);
        background-size: 24px 24px;
      }
      .dark .custom-grid-pattern {
        background-image: radial-gradient(circle, #334155 1px, transparent 1px);
      }
    `;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);

  function updateActionConfig(key: 'title' | 'body', value: string) {
    onNodesChange(nodes.map((node) => (
      node.kind === 'action.notification.create'
        ? { ...node, config: { ...node.config, [key]: value, target: 'self' } }
        : node
    )));
  }

  const selected = nodes.find((node) => node.id === selectedNode);

  return (
    <div className="flex-1 flex overflow-hidden">
      <NodeSidebar
        isOpen={isSidebarOpen}
        onSelectNode={(node) => {
          if (!nodes.some((existing) => existing.kind === node.kind)) {
            onNodesChange([...nodes, { ...node, id: `${node.kind}-${Date.now()}` }]);
          }
        }}
        onClose={() => setIsSidebarOpen(false)}
      />

      <div className="flex-1 bg-gray-50/30 dark:bg-dark-bg/50 relative overflow-y-auto overflow-x-hidden WorkflowCanvas p-8 pb-32 flex justify-center custom-grid-pattern">
        {!isSidebarOpen && (
          <button onClick={() => setIsSidebarOpen(true)} className="fixed bottom-6 left-6 z-20 bg-white dark:bg-dark-card shadow-lg border border-gray-200 dark:border-dark-border text-gray-700 dark:text-gray-300 rounded-lg px-4 py-3 font-bold text-sm flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-slate-800 transition">
            <Plus className="w-5 h-5" /> Tool Palette
          </button>
        )}

        <div className="flex flex-col items-center w-full max-w-2xl relative z-10 pt-12">
          {nodes.map((node, index) => {
            const Icon = node.icon;
            const isSelected = selectedNode === node.id;
            return (
              <div key={node.id} className="flex flex-col items-center w-full relative">
                <div
                  onClick={() => setSelectedNode(node.id)}
                  className={`w-full max-w-md bg-white dark:bg-dark-card rounded-lg border-2 transition-all cursor-pointer shadow-sm relative group
                    ${isSelected ? 'border-primary-500 shadow-md ring-4 ring-primary-500/10' : 'border-gray-200 dark:border-dark-border hover:border-gray-300 dark:hover:border-slate-600 hover:shadow-md'}`}
                >
                  <div className={`absolute -top-3 left-6 px-3 py-0.5 rounded-full text-[10px] font-black uppercase border
                    ${node.type === 'trigger' ? 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/40 dark:text-yellow-400 dark:border-yellow-800/50' : 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-400 dark:border-blue-800/50'}`}>
                    {node.type}
                  </div>

                  {node.type !== 'trigger' && (
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        onNodesChange(nodes.filter((item) => item.id !== node.id));
                        setSelectedNode(null);
                      }}
                      className="absolute -top-3 -right-3 w-7 h-7 bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-full flex items-center justify-center text-gray-400 hover:text-red-500 hover:border-red-500 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity z-10"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <div className="p-5 flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${node.iconBg} ${node.iconColor}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <div className="flex-1 mt-0.5 min-w-0">
                      <h4 className="font-bold text-gray-900 dark:text-white text-base leading-tight mb-1 flex items-center justify-between">
                        {node.title}
                        <MoreHorizontal className="w-4 h-4 text-gray-300 dark:text-slate-600" />
                      </h4>
                      <p className="text-xs font-medium text-gray-500 line-clamp-2">{node.description}</p>
                    </div>
                  </div>

                  {isSelected && (
                    <div className="bg-gray-50 dark:bg-slate-800/50 p-3 border-t border-gray-100 dark:border-dark-border rounded-b-lg flex items-center justify-between text-xs font-semibold text-gray-500">
                      <span className="flex items-center gap-1.5"><Settings className="w-3.5 h-3.5" /> Configured for MVP</span>
                    </div>
                  )}
                </div>

                {index < nodes.length - 1 && (
                  <div className="flex flex-col items-center">
                    <div className="h-4 w-px bg-gray-300 dark:bg-slate-600"></div>
                    <div className="w-7 h-7 rounded-full flex items-center justify-center bg-white dark:bg-dark-card border-2 border-gray-300 dark:border-slate-600 text-gray-400 z-10">
                      <ArrowDown className="w-3.5 h-3.5" />
                    </div>
                    <div className="h-4 w-px bg-gray-300 dark:bg-slate-600"></div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {selected?.kind === 'action.notification.create' && (
        <div className="w-80 bg-white dark:bg-dark-card border-l border-gray-200 dark:border-dark-border p-5 space-y-4">
          <div>
            <h2 className="font-black text-gray-900 dark:text-white">Notification Action</h2>
            <p className="text-xs text-gray-500 mt-1">Target is fixed to the current signed-in user for the MVP.</p>
          </div>
          <label className="block">
            <span className="text-xs font-bold uppercase text-gray-500">Title</span>
            <input
              value={selected.config.title ?? ''}
              onChange={(event) => updateActionConfig('title', event.target.value)}
              className="mt-1 w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg py-2 px-3 text-sm focus:ring-2 focus:ring-primary-500 dark:text-white"
            />
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase text-gray-500">Body</span>
            <textarea
              value={selected.config.body ?? ''}
              onChange={(event) => updateActionConfig('body', event.target.value)}
              rows={5}
              className="mt-1 w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg py-2 px-3 text-sm focus:ring-2 focus:ring-primary-500 dark:text-white"
            />
          </label>
        </div>
      )}
    </div>
  );
}
