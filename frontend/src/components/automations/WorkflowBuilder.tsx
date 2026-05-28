'use client';

import { useState, useEffect } from 'react';
import NodeSidebar from '@/components/automations/NodeSidebar';
import { 
  Zap, 
  GitBranch, 
  Settings, 
  ArrowDown, 
  Plus, 
  MoreHorizontal, 
  AlertCircle,
  Truck,
  FileSpreadsheet,
  FileText,
  Mail,
  X
} from 'lucide-react';

export type NodeType = 'trigger' | 'condition' | 'action';

export interface WorkflowNode {
  id: string;
  type: NodeType;
  title: string;
  description: string;
  icon: any; // Lucide icon reference
  iconColor: string;
  iconBg: string;
  config?: any;
}

const initialNodes: WorkflowNode[] = [
  {
    id: 'node-1',
    type: 'trigger',
    title: 'New Shipment Posted',
    description: 'Triggered when a shipper posts a new load.',
    icon: Zap,
    iconColor: 'text-yellow-500',
    iconBg: 'bg-yellow-100 dark:bg-yellow-900/30'
  }
];

export default function WorkflowBuilder() {
  const [nodes, setNodes] = useState<WorkflowNode[]>(initialNodes);

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
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // For deciding where to inject a new node. null means append to end.
  const [insertAfterId, setInsertAfterId] = useState<string | null>(null);

  const handleAddNode = (newNodeData: Omit<WorkflowNode, 'id'>) => {
    const newNode = { ...newNodeData, id: `node-${Date.now()}` };
    
    if (insertAfterId) {
      const idx = nodes.findIndex(n => n.id === insertAfterId);
      const newNodes = [...nodes];
      newNodes.splice(idx + 1, 0, newNode);
      setNodes(newNodes);
      setInsertAfterId(null);
    } else {
      setNodes([...nodes, newNode]);
    }
  };

  const handleDeleteNode = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if(nodes.length === 1 && nodes[0].type === 'trigger') return; // Cannot delete initial trigger
    setNodes(nodes.filter(n => n.id !== id));
    if(selectedNode === id) setSelectedNode(null);
  };

  return (
    <div className="flex-1 flex overflow-hidden">
      
      {/* Tool Palette Sidebar */}
      <NodeSidebar 
        isOpen={isSidebarOpen} 
        onSelectNode={handleAddNode} 
        onClose={() => setIsSidebarOpen(false)} 
      />

      {/* Canvas Area */}
      <div className="flex-1 bg-gray-50/30 dark:bg-dark-bg/50 relative overflow-y-auto overflow-x-hidden WorkflowCanvas p-8 pb-32 flex justify-center custom-grid-pattern">
         
         {!isSidebarOpen && (
            <button onClick={() => setIsSidebarOpen(true)} className="fixed bottom-6 left-6 z-20 bg-white dark:bg-dark-card shadow-lg border border-gray-200 dark:border-dark-border text-gray-700 dark:text-gray-300 rounded-xl px-4 py-3 font-bold text-sm flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-slate-800 transition">
               <Plus className="w-5 h-5"/> Tool Palette
            </button>
         )}

         <div className="flex flex-col items-center w-full max-w-2xl relative z-10 pt-12">
            
            {nodes.map((node, index) => {
               const Icon = node.icon;
               const isSelected = selectedNode === node.id;
               const isHoveredTarget = insertAfterId === node.id;

               return (
                 <div key={node.id} className="flex flex-col items-center w-full relative">
                    
                    {/* The Node Card */}
                    <div 
                       onClick={() => setSelectedNode(node.id)}
                       className={`w-full max-w-md bg-white dark:bg-dark-card rounded-2xl border-2 transition-all cursor-pointer shadow-sm relative group
                         ${isSelected ? 'border-primary-500 shadow-md ring-4 ring-primary-500/10' : 'border-gray-200 dark:border-dark-border hover:border-gray-300 dark:hover:border-slate-600 hover:shadow-md'}
                       `}
                    >
                       {/* Node Type Badge (Trigger, Condition, Action) */}
                       <div className={`absolute -top-3 left-6 px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider shadow-sm border
                          ${node.type === 'trigger' ? 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/40 dark:text-yellow-400 dark:border-yellow-800/50' : 
                            node.type === 'condition' ? 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-400 dark:border-indigo-800/50' :
                            'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-400 dark:border-blue-800/50'
                          }`}>
                         {node.type}
                       </div>

                       {/* Delete Button */}
                       {!(node.type === 'trigger' && index === 0) && (
                          <button 
                             onClick={(e) => handleDeleteNode(node.id, e)}
                             className="absolute -top-3 -right-3 w-7 h-7 bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-full flex items-center justify-center text-gray-400 hover:text-red-500 hover:border-red-500 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity z-10">
                             <X className="w-3.5 h-3.5" />
                          </button>
                       )}

                       <div className="p-5 flex items-start gap-4">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${node.iconBg} ${node.iconColor}`}>
                             <Icon className="w-6 h-6" />
                          </div>
                          <div className="flex-1 mt-0.5">
                             <h4 className="font-bold text-gray-900 dark:text-white text-base leading-tight mb-1 flex items-center justify-between">
                               {node.title} 
                               <MoreHorizontal className="w-4 h-4 text-gray-300 dark:text-slate-600" />
                             </h4>
                             <p className="text-xs font-medium text-gray-500 line-clamp-2">
                               {node.description}
                             </p>
                          </div>
                       </div>
                       
                       {/* Config Hook Indicator (Only show if selected for MVP) */}
                       {isSelected && (
                         <div className="bg-gray-50 dark:bg-slate-800/50 p-3 border-t border-gray-100 dark:border-dark-border rounded-b-2xl flex items-center justify-between text-xs font-semibold text-gray-500 animate-fade-in">
                            <span className="flex items-center gap-1.5"><Settings className="w-3.5 h-3.5"/> Node fully configured</span>
                            <button className="text-primary-600 dark:text-primary-400 hover:underline">Edit logic</button>
                         </div>
                       )}
                    </div>

                    {/* The Connecting Line to Next Node */}
                    {index < nodes.length - 1 && (
                      <div className="flex flex-col items-center group/line cursor-pointer" onClick={() => setInsertAfterId(node.id)}>
                         <div className="h-4 w-px bg-gray-300 dark:bg-slate-600 transition-colors group-hover/line:bg-primary-400"></div>
                         <div className={`w-7 h-7 rounded-full flex items-center justify-center transition-all bg-white dark:bg-dark-card border-2 z-10 
                           ${isHoveredTarget ? 'border-primary-500 scale-110 text-primary-500' : 'border-gray-300 dark:border-slate-600 text-gray-400 group-hover/line:border-primary-400 group-hover/line:text-primary-500'}
                         `}>
                           {isHoveredTarget ? <Plus className="w-4 h-4" /> : <ArrowDown className="w-3.5 h-3.5" />}
                         </div>
                         <div className="h-4 w-px bg-gray-300 dark:bg-slate-600 transition-colors group-hover/line:bg-primary-400"></div>
                      </div>
                    )}
                 </div>
               );
            })}

            {/* End of Workflow Add Button */}
            <div className="flex flex-col items-center mt-2 group/end cursor-pointer" onClick={() => setInsertAfterId(null)}>
               <div className="h-6 w-px bg-gray-300 dark:bg-slate-600 border-dashed border-l-2 transition-colors group-hover/end:border-primary-400"></div>
               <div className="w-12 h-12 rounded-full border-2 border-dashed border-gray-300 dark:border-slate-600 flex items-center justify-center bg-white dark:bg-dark-bg text-gray-400 hover:border-primary-500 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all z-10 shadow-sm">
                  <Plus className="w-6 h-6" />
               </div>
               <span className="text-xs font-bold text-gray-400 mt-2 opacity-0 group-hover/end:opacity-100 transition-opacity">Add Next Step</span>
            </div>

         </div>

      </div>

    </div>
  );
}
