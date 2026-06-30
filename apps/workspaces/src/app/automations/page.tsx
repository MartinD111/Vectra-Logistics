'use client';

import Link from 'next/link';
import { 
  Zap, 
  Plus, 
  Play, 
  Clock, 
  MoreVertical, 
  CheckCircle2, 
  AlertCircle,
  FolderOpen
} from 'lucide-react';

const mockWorkflows = [
  { id: 'wf-1', name: 'Auto CMR Generation', triggers: 'On Shipment Confirm', status: 'active', successRate: '99.8%', lastRun: '10 mins ago' },
  { id: 'wf-2', name: 'VIN List Cleaner & Sync', triggers: 'On Excel Upload', status: 'active', successRate: '100%', lastRun: '2 hours ago' },
  { id: 'wf-3', name: 'Weekly Fleet Utilization', triggers: 'Schedule (Friday)', status: 'active', successRate: '95.0%', lastRun: '3 days ago' },
  { id: 'wf-4', name: 'Low Capacity Alert', triggers: 'Capacity < 10%', status: 'paused', successRate: 'N/A', lastRun: 'Never' },
];

export default function AutomationsDashboard() {
  return (
    <div className="min-h-[calc(100vh-80px)] bg-gray-50/50 dark:bg-dark-bg text-gray-900 dark:text-gray-100 pb-12">
      <div className="max-w-7xl mx-auto px-4 lg:px-8 py-8 animate-fade-in">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 border-b border-gray-200 dark:border-dark-border pb-6">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-gray-900 dark:text-white flex items-center gap-3">
              Workflow <span className="text-primary-600 dark:text-primary-400">Automations</span>
            </h1>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 max-w-2xl">
              Connect Vectra events, trigger advanced actions, and automate your daily logistics operations.
            </p>
          </div>
          <Link href="/automations/builder" className="flex items-center gap-2 bg-primary-600 hover:bg-primary-500 text-white px-5 py-3 rounded-xl font-bold shadow-md transition hover:-translate-y-0.5 whitespace-nowrap">
            <Plus className="w-5 h-5" /> Create New Workflow
          </Link>
        </div>

        {/* Quick Stats / Templates */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
           <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-3xl p-6 text-white shadow-lg relative overflow-hidden group hover:shadow-xl transition-shadow cursor-pointer">
              <div className="absolute -right-4 -top-4 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition-colors"></div>
              <h3 className="text-xl font-black mb-1 relative z-10">Templates</h3>
              <p className="text-indigo-100 text-sm mb-6 relative z-10">Start fast with pre-built logistics chains.</p>
              <div className="flex items-center gap-2 text-sm font-bold bg-white/20 hover:bg-white/30 transition px-4 py-2 rounded-lg w-max backdrop-blur-md relative z-10">
                 Browse Gallery <Zap className="w-4 h-4 fill-white text-white"/>
              </div>
           </div>
           
           <div className="bg-white dark:bg-dark-card rounded-3xl p-6 border border-gray-100 dark:border-dark-border shadow-sm flex flex-col justify-center text-center">
              <div className="text-4xl font-black text-gray-900 dark:text-white mb-2">1,204</div>
              <div className="text-sm font-bold text-gray-500 uppercase tracking-wider">Automations Run This Month</div>
           </div>

           <div className="bg-white dark:bg-dark-card rounded-3xl p-6 border border-gray-100 dark:border-dark-border shadow-sm flex flex-col justify-center text-center">
              <div className="text-4xl font-black text-green-500 mb-2">99.8%</div>
              <div className="text-sm font-bold text-gray-500 uppercase tracking-wider">Average Success Rate</div>
           </div>
        </div>

        {/* My Workflows List */}
        <div className="bg-white dark:bg-dark-card rounded-2xl border border-gray-100 dark:border-dark-border shadow-sm overflow-hidden flex flex-col">
           <div className="p-5 border-b border-gray-100 dark:border-dark-border flex items-center justify-between">
             <h2 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-gray-400" /> My Active Workflows
             </h2>
           </div>
           
           <div className="overflow-x-auto">
             <table className="w-full text-left border-collapse min-w-[700px]">
               <thead>
                 <tr className="bg-gray-50 dark:bg-slate-800/50 border-b border-gray-100 dark:border-dark-border text-xs uppercase tracking-wider text-gray-500 font-bold">
                   <th className="p-4 pl-6">Workflow Details</th>
                   <th className="p-4">Trigger Event</th>
                   <th className="p-4">Health / Success</th>
                   <th className="p-4">Last Execution</th>
                   <th className="p-4 relative">Actions</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-gray-100 dark:divide-dark-border">
                 {mockWorkflows.map((wf) => (
                   <tr key={wf.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/30 transition-colors group">
                     <td className="p-4 pl-6">
                        <div className="flex items-center gap-3">
                           <div className={`p-2 rounded-lg ${wf.status === 'active' ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400' : 'bg-gray-100 dark:bg-slate-800 text-gray-400'}`}>
                              <Zap className="w-5 h-5" />
                           </div>
                           <div>
                              <div className="font-bold text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 cursor-pointer transition-colors max-w-[250px] truncate">{wf.name}</div>
                              <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                                 <div className={`w-1.5 h-1.5 rounded-full ${wf.status === 'active' ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                                 <span className="capitalize">{wf.status}</span>
                              </div>
                           </div>
                        </div>
                     </td>
                     <td className="p-4 text-sm font-semibold text-gray-600 dark:text-gray-300">
                        <span className="bg-gray-100 dark:bg-slate-800 px-2.5 py-1 rounded-md text-xs border border-gray-200 dark:border-slate-700 whitespace-nowrap">
                           {wf.triggers}
                        </span>
                     </td>
                     <td className="p-4">
                        <div className="flex items-center gap-1.5">
                           {wf.status === 'active' ? (
                             <><CheckCircle2 className="w-4 h-4 text-green-500" /> <span className="text-sm font-bold text-gray-900 dark:text-white">{wf.successRate}</span></>
                           ) : (
                             <><AlertCircle className="w-4 h-4 text-gray-400" /> <span className="text-sm font-bold text-gray-500">{wf.successRate}</span></>
                           )}
                        </div>
                     </td>
                     <td className="p-4">
                        <div className="flex items-center gap-1.5 text-sm font-medium text-gray-500">
                           <Clock className="w-4 h-4" /> {wf.lastRun}
                        </div>
                     </td>
                     <td className="p-4">
                        <div className="flex items-center gap-2">
                           {wf.status === 'active' && (
                             <button className="text-xs font-bold text-gray-600 dark:text-gray-300 bg-white dark:bg-dark-bg border border-gray-200 dark:border-slate-700 hover:bg-gray-50 hover:text-gray-900 dark:hover:bg-slate-800 dark:hover:text-white transition px-3 py-1.5 rounded-lg flex items-center gap-1 whitespace-nowrap shadow-sm opacity-0 group-hover:opacity-100 focus:opacity-100">
                                Run Now <Play className="w-3 h-3" />
                             </button>
                           )}
                           <button className="text-gray-400 hover:text-gray-900 dark:hover:text-white transition opacity-0 group-hover:opacity-100 focus:opacity-100 p-1">
                              <MoreVertical className="w-5 h-5" />
                           </button>
                        </div>
                     </td>
                   </tr>
                 ))}
               </tbody>
             </table>
           </div>
           {/* Pagination Footer Mock */}
           <div className="bg-gray-50 dark:bg-slate-800/80 border-t border-gray-100 dark:border-dark-border p-4 flex items-center justify-between text-xs font-semibold text-gray-500">
              <span>Showing 4 of 4 workflows</span>
              <div className="flex gap-2">
                 <button className="px-3 py-1 rounded-md hover:bg-gray-200 dark:hover:bg-slate-700 transition" disabled>Previous</button>
                 <button className="px-3 py-1 rounded-md hover:bg-gray-200 dark:hover:bg-slate-700 transition" disabled>Next</button>
              </div>
           </div>
        </div>

      </div>
    </div>
  );
}
