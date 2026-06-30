'use client';

import { 
  Zap, 
  GitBranch, 
  Truck,
  FileSpreadsheet,
  FileText,
  Mail,
  AlertCircle,
  Database,
  X,
  Search,
  Plus
} from 'lucide-react';
import { NodeType, WorkflowNode } from './WorkflowBuilder';
import { useState } from 'react';

// Pre-defined automation nodes available for drag & drop / click to add
const AVAILABLE_NODES: Omit<WorkflowNode, 'id'>[] = [
  // TRIGGERS
  { type: 'trigger', title: 'New Shipment Posted', description: 'Fires when a new shipment enters the marketplace.', icon: Zap, iconColor: 'text-yellow-500', iconBg: 'bg-yellow-100 dark:bg-yellow-900/30' },
  { type: 'trigger', title: 'Excel File Uploaded', description: 'Fires when a user drops a new file in Workspaces.', icon: FileSpreadsheet, iconColor: 'text-green-500', iconBg: 'bg-green-100 dark:bg-green-900/30' },
  { type: 'trigger', title: 'Capacity Matched', description: 'Fires when a truck matches a pending shipment.', icon: Truck, iconColor: 'text-blue-500', iconBg: 'bg-blue-100 dark:bg-blue-900/30' },
  
  // CONDITIONS
  { type: 'condition', title: 'Branch on Value', description: 'Split flow based on specific data logic (e.g. Weight > 20t).', icon: GitBranch, iconColor: 'text-indigo-500', iconBg: 'bg-indigo-100 dark:bg-indigo-900/30' },
  { type: 'condition', title: 'Data Exists Check', description: 'Only proceed if specific document or field exists.', icon: Database, iconColor: 'text-indigo-500', iconBg: 'bg-indigo-100 dark:bg-indigo-900/30' },

  // ACTIONS
  { type: 'action', title: 'Auto-Assign Fleet', description: 'Runs the Fleet Load Planner algorithm on the load.', icon: Truck, iconColor: 'text-primary-500', iconBg: 'bg-primary-100 dark:bg-primary-900/30' },
  { type: 'action', title: 'Run Excel Macro', description: 'Applies a saved Excel Automation Template to the data.', icon: FileSpreadsheet, iconColor: 'text-green-500', iconBg: 'bg-green-100 dark:bg-green-900/30' },
  { type: 'action', title: 'Generate CMR', description: 'Automatically maps and generates a PDF CMR document.', icon: FileText, iconColor: 'text-purple-500', iconBg: 'bg-purple-100 dark:bg-purple-900/30' },
  { type: 'action', title: 'Send Email Auth', description: 'Sends an approval or notification email to carriers.', icon: Mail, iconColor: 'text-orange-500', iconBg: 'bg-orange-100 dark:bg-orange-900/30' },
  { type: 'action', title: 'Throw Alert', description: 'Shows a persistent UI alert on the user Dashboard.', icon: AlertCircle, iconColor: 'text-red-500', iconBg: 'bg-red-100 dark:bg-red-900/30' },
];

interface Props {
  isOpen: boolean;
  onSelectNode: (node: Omit<WorkflowNode, 'id'>) => void;
  onClose: () => void;
}

export default function NodeSidebar({ isOpen, onSelectNode, onClose }: Props) {
  const [searchTerm, setSearchTerm] = useState('');

  if (!isOpen) return null;

  const filteredNodes = AVAILABLE_NODES.filter(n => n.title.toLowerCase().includes(searchTerm.toLowerCase()));

  const triggers = filteredNodes.filter(n => n.type === 'trigger');
  const conditions = filteredNodes.filter(n => n.type === 'condition');
  const actions = filteredNodes.filter(n => n.type === 'action');

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
               onChange={e => setSearchTerm(e.target.value)}
               className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl py-2 pl-9 pr-4 text-sm focus:ring-2 focus:ring-primary-500 dark:text-white transition-all shadow-sm"
             />
          </div>
       </div>

       <div className="flex-1 overflow-y-auto p-4 space-y-6">
          
          {triggers.length > 0 && (
            <div>
               <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3 ml-1">Triggers</h3>
               <div className="space-y-2">
                 {triggers.map((node, i) => (
                    <NodeDraggableCard key={i} node={node} onClick={() => onSelectNode(node)} />
                 ))}
               </div>
            </div>
          )}

          {conditions.length > 0 && (
            <div>
               <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3 ml-1">Logic & Routing</h3>
               <div className="space-y-2">
                 {conditions.map((node, i) => (
                    <NodeDraggableCard key={i} node={node} onClick={() => onSelectNode(node)} />
                 ))}
               </div>
            </div>
          )}

          {actions.length > 0 && (
            <div>
               <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3 ml-1">Actions & Integrations</h3>
               <div className="space-y-2">
                 {actions.map((node, i) => (
                    <NodeDraggableCard key={i} node={node} onClick={() => onSelectNode(node)} />
                 ))}
               </div>
            </div>
          )}

       </div>

    </div>
  );
}

function NodeDraggableCard({ node, onClick }: { node: Omit<WorkflowNode, 'id'>, onClick: () => void }) {
  const Icon = node.icon;
  return (
    <div 
      onClick={onClick}
      className="p-3 bg-white dark:bg-dark-card border border-gray-200 dark:border-slate-700 rounded-xl hover:border-primary-400 dark:hover:border-primary-500 hover:shadow-md transition-all cursor-pointer group relative flex items-start gap-3"
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
    </div>
  );
}
