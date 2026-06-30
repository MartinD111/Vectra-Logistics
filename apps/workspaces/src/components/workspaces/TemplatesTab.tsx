'use client';

import { 
  Folder, 
  Search, 
  MoreVertical, 
  FileSpreadsheet, 
  Clock, 
  Copy, 
  Play
} from 'lucide-react';

const templates = [
  { id: 1, name: 'Standard VIN Clean', folder: 'VIN Management', runs: 245, updated: '2 days ago' },
  { id: 2, name: 'Daily Load Report', folder: 'Reports', runs: 112, updated: '1 week ago' },
  { id: 3, name: 'CMR Data Extractor', folder: 'Document Prep', runs: 89, updated: '3 days ago' },
  { id: 4, name: 'Trailer Assignments', folder: 'Fleet', runs: 156, updated: 'Yesterday' },
  { id: 5, name: 'Customer Invoice Gen', folder: 'Finance', runs: 34, updated: '2 weeks ago' },
];

const folders = ['All Templates', 'VIN Management', 'Reports', 'Document Prep', 'Fleet', 'Finance'];

export default function TemplatesTab() {
  return (
    <div className="animate-fade-in flex flex-col lg:flex-row gap-8 pb-12">
      
      {/* Sidebar - Folders */}
      <div className="w-full lg:w-64 flex-shrink-0">
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-4 px-3">Folders</h3>
        <nav className="space-y-1">
          {folders.map((folder, idx) => (
            <button key={idx} className={`w-full flex items-center justify-between px-3 py-2 text-sm font-semibold rounded-lg transition ${
              idx === 0 
                ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400' 
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800'
            }`}>
              <div className="flex items-center gap-2.5">
                <Folder className={`w-4 h-4 ${idx === 0 ? 'text-primary-500' : 'text-gray-400'}`} />
                {folder}
              </div>
              {idx !== 0 && <span className="text-xs bg-gray-100 dark:bg-slate-800 px-2 py-0.5 rounded-full text-gray-500">{Math.floor(Math.random() * 10) + 1}</span>}
            </button>
          ))}
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 space-y-6">
        
        {/* Top bar */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-white dark:bg-dark-card p-4 rounded-2xl border border-gray-100 dark:border-dark-border shadow-sm">
          <div className="relative w-full sm:max-w-md">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Search className="h-4 w-4 text-gray-400" aria-hidden="true" />
            </div>
            <input
              type="text"
              name="search"
              id="search"
              className="block w-full rounded-xl border-0 py-2.5 pl-10 text-gray-900 dark:text-white dark:bg-slate-900 ring-1 ring-inset ring-gray-200 dark:ring-dark-border placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6 transition"
              placeholder="Search templates..."
            />
          </div>
          <button className="whitespace-nowrap bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-4 py-2.5 rounded-xl font-bold text-sm hover:opacity-90 transition">
            Create Template
          </button>
        </div>

        {/* Template Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-5">
          {templates.map(template => (
            <div key={template.id} className="bg-white dark:bg-dark-card p-5 rounded-2xl border border-gray-100 dark:border-dark-border shadow-sm hover:shadow-md transition-shadow group relative flex flex-col">
              <div className="flex justify-between items-start mb-4">
                 <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center text-primary-600 dark:text-primary-400">
                    <FileSpreadsheet className="w-5 h-5" />
                 </div>
                 <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition">
                    <MoreVertical className="w-5 h-5" />
                 </button>
              </div>
              
              <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-1">{template.name}</h4>
              <p className="text-xs font-semibold text-primary-600 dark:text-primary-400 mb-4">{template.folder}</p>
              
              <div className="mt-auto pt-4 border-t border-gray-100 dark:border-dark-border flex items-center justify-between">
                <div className="flex items-center gap-3 text-xs text-gray-500 font-medium">
                   <div className="flex items-center gap-1"><Play className="w-3.5 h-3.5" /> {template.runs} runs</div>
                   <div className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {template.updated}</div>
                </div>
              </div>

              {/* Hover Overlay Actions */}
              <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-white via-white to-transparent dark:from-dark-card dark:via-dark-card opacity-0 group-hover:opacity-100 transition-opacity flex justify-end gap-2 rounded-b-2xl">
                 <button className="p-2 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-700 transition tooltip-trigger" title="Clone Template">
                    <Copy className="w-4 h-4" />
                 </button>
                 <button className="px-4 py-2 font-bold text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-500 transition shadow-sm flex items-center gap-1.5">
                    <Play className="w-4 h-4" /> Use
                 </button>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
