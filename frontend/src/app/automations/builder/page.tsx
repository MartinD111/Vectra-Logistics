'use client';

import { useState } from 'react';
import WorkflowBuilder from '@/components/automations/WorkflowBuilder';
import Link from 'next/link';
import { ArrowLeft, Play, Save, Settings2, History } from 'lucide-react';

export default function WorkflowBuilderPage() {
  const [workflowName, setWorkflowName] = useState('Untitled Workflow');

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-dark-bg text-gray-900 dark:text-gray-100 flex flex-col">
      
      {/* Builder Top Navbar */}
      <div className="h-16 bg-white dark:bg-dark-card border-b border-gray-200 dark:border-dark-border flex items-center justify-between px-4 lg:px-6 shadow-sm z-10 relative">
         <div className="flex items-center gap-4">
            <Link href="/automations" className="p-2 text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition">
               <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="h-6 w-px bg-gray-200 dark:bg-dark-border"></div>
            <input 
              type="text" 
              value={workflowName}
              onChange={(e) => setWorkflowName(e.target.value)}
              className="font-black text-lg text-gray-900 dark:text-white bg-transparent border-0 focus:ring-0 p-0 w-64 md:w-96 placeholder:text-gray-300" 
              placeholder="Name your automation..."
            />
         </div>
         <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 px-3 py-2 text-sm font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition">
               <History className="w-4 h-4" /> <span className="hidden sm:inline">Execution Logs</span>
            </button>
            <button className="flex items-center gap-2 px-3 py-2 text-sm font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition">
               <Settings2 className="w-4 h-4" /> <span className="hidden sm:inline">Settings</span>
            </button>
            <div className="h-6 w-px bg-gray-200 dark:bg-dark-border mx-1"></div>
            <button className="flex items-center gap-2 px-4 py-2 text-sm font-bold bg-white dark:bg-dark-card text-gray-900 dark:text-white border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-xl transition shadow-sm">
               <Save className="w-4 h-4" /> Save
            </button>
            <button className="flex items-center gap-2 px-5 py-2 text-sm font-bold bg-primary-600 text-white rounded-xl hover:bg-primary-500 shadow-md transition">
               <Play className="w-4 h-4" /> Publish & Turn On
            </button>
         </div>
      </div>

      {/* Main Builder Canvas Area */}
      <div className="flex-1 relative overflow-hidden flex">
         <WorkflowBuilder />
      </div>

    </div>
  );
}
