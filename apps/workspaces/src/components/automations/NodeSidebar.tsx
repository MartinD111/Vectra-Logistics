'use client';

import { Bell, Plus, Search, X, Zap } from 'lucide-react';
import { WorkflowNode } from './WorkflowBuilder';
import { useState } from 'react';

const AVAILABLE_NODES: Omit<WorkflowNode, 'id'>[] = [
  {
    type: 'trigger',
    kind: 'trigger.manual',
    title: 'Manual Trigger',
    description: 'Starts when a dispatcher clicks Run Now.',
    icon: Zap,
    iconColor: 'text-yellow-500',
    iconBg: 'bg-yellow-100 dark:bg-yellow-900/30',
    config: {},
  },
  {
    type: 'action',
    kind: 'action.notification.create',
    title: 'Create Notification',
    description: 'Creates a durable in-app notification for yourself.',
    icon: Bell,
    iconColor: 'text-blue-500',
    iconBg: 'bg-blue-100 dark:bg-blue-900/30',
    config: { title: 'Workflow ran', body: 'Manual workflow completed.', target: 'self' },
  },
];

interface Props {
  isOpen: boolean;
  onSelectNode: (node: Omit<WorkflowNode, 'id'>) => void;
  onClose: () => void;
}

export default function NodeSidebar({ isOpen, onSelectNode, onClose }: Props) {
  const [searchTerm, setSearchTerm] = useState('');

  if (!isOpen) return null;

  const filteredNodes = AVAILABLE_NODES.filter((node) => node.title.toLowerCase().includes(searchTerm.toLowerCase()));
  const triggers = filteredNodes.filter((node) => node.type === 'trigger');
  const actions = filteredNodes.filter((node) => node.type === 'action');

  return (
    <div className="w-80 bg-white dark:bg-dark-card border-r border-gray-200 dark:border-dark-border flex flex-col h-full animate-fade-in z-20 shadow-xl lg:shadow-none">
      <div className="p-4 border-b border-gray-100 dark:border-dark-border flex items-center justify-between">
        <h2 className="font-black text-gray-900 dark:text-white">Tool Palette</h2>
        <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="p-4 border-b border-gray-100 dark:border-dark-border">
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search modules..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg py-2 pl-9 pr-4 text-sm focus:ring-2 focus:ring-primary-500 dark:text-white transition-all shadow-sm"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {triggers.length > 0 && (
          <div>
            <h3 className="text-xs font-bold uppercase text-gray-500 mb-3 ml-1">Triggers</h3>
            <div className="space-y-2">
              {triggers.map((node) => (
                <NodeDraggableCard key={node.kind} node={node} onClick={() => onSelectNode(node)} />
              ))}
            </div>
          </div>
        )}

        {actions.length > 0 && (
          <div>
            <h3 className="text-xs font-bold uppercase text-gray-500 mb-3 ml-1">Actions</h3>
            <div className="space-y-2">
              {actions.map((node) => (
                <NodeDraggableCard key={node.kind} node={node} onClick={() => onSelectNode(node)} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function NodeDraggableCard({ node, onClick }: { node: Omit<WorkflowNode, 'id'>; onClick: () => void }) {
  const Icon = node.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left p-3 bg-white dark:bg-dark-card border border-gray-200 dark:border-slate-700 rounded-lg hover:border-primary-400 dark:hover:border-primary-500 hover:shadow-md transition-all group relative flex items-start gap-3"
    >
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${node.iconBg} ${node.iconColor}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <h4 className="font-bold text-gray-900 dark:text-white text-sm mb-0.5 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">{node.title}</h4>
        <p className="text-[10px] text-gray-500 line-clamp-2 leading-tight">{node.description}</p>
      </div>
      <div className="absolute top-1/2 -translate-y-1/2 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="w-6 h-6 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center text-gray-600 dark:text-gray-300">
          <Plus className="w-4 h-4" />
        </div>
      </div>
    </button>
  );
}
