'use strict';
'use client';

import { useState } from 'react';
import { 
  Home, 
  FileSpreadsheet, 
  LayoutTemplate, 
  Truck,
  Plus, 
  Star,
  Clock,
  Pin
} from 'lucide-react';

const pinnedTools = [
  { id: 1, name: 'Weekly Load Planner', type: 'Excel Automation', color: 'bg-blue-500', isPinned: true },
  { id: 2, name: 'VIN Extractor Pro', type: 'Logistics Module', color: 'bg-indigo-500', isPinned: true },
  { id: 3, name: 'CMR Auto-fill', type: 'Template', color: 'bg-purple-500', isPinned: true },
];

const recentTools = [
  { id: 4, name: 'Cargo Weight Analyzer', date: '2 hours ago' },
  { id: 5, name: 'Fleet Utilization Report', date: 'Yesterday' },
  { id: 6, name: 'Route Optimization Base', date: '3 days ago' },
];

export default function DashboardTab() {
  const [pins, setPins] = useState(pinnedTools);

  const togglePin = (id: number) => {
    setPins(pins.map(t => t.id === id ? { ...t, isPinned: !t.isPinned } : t));
  };

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-900 dark:text-white">Workspace Dashboard</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Manage your automation tools, templates, and fleet operations.</p>
        </div>
        <button className="flex items-center gap-2 bg-primary-600 hover:bg-primary-500 text-white px-5 py-2.5 rounded-xl font-semibold shadow-sm transition hover:-translate-y-0.5">
          <Plus className="w-5 h-5" /> Active Workflows
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content Area */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Quick Access / Favorites */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Star className="w-5 h-5 text-yellow-500" /> Quick Access
              </h3>
              <button className="text-sm font-semibold text-primary-600 hover:text-primary-500 transition">View All</button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {pins.map(tool => (
                <div key={tool.id} className="group relative bg-white dark:bg-dark-card rounded-2xl p-5 border border-gray-100 dark:border-dark-border shadow-sm hover:shadow-md transition-all">
                  <button 
                    onClick={() => togglePin(tool.id)}
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition"
                  >
                    <Pin className={`w-4 h-4 ${tool.isPinned ? 'fill-current text-primary-500' : ''}`} />
                  </button>
                  <div className={`w-10 h-10 rounded-xl ${tool.color} flex items-center justify-center mb-4 shadow-sm`}>
                    <FileSpreadsheet className="w-5 h-5 text-white" />
                  </div>
                  <h4 className="font-bold text-gray-900 dark:text-white mb-1 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">{tool.name}</h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">{tool.type}</p>
                </div>
              ))}
              
              <div className="bg-gray-50 dark:bg-slate-800/50 rounded-2xl p-5 border border-dashed border-gray-200 dark:border-slate-700 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors group">
                <div className="w-10 h-10 rounded-full bg-white dark:bg-dark-bg flex items-center justify-center mb-3 shadow-sm group-hover:scale-110 transition-transform">
                  <Plus className="w-5 h-5 text-primary-600" />
                </div>
                <h4 className="font-bold text-gray-700 dark:text-gray-300">Create New Tool</h4>
              </div>
            </div>
          </section>

          {/* Recently Used */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-500" /> Recently Used
              </h3>
            </div>
            
            <div className="bg-white dark:bg-dark-card rounded-2xl border border-gray-100 dark:border-dark-border overflow-hidden shadow-sm">
              <ul className="divide-y divide-gray-100 dark:divide-dark-border">
                {recentTools.map(tool => (
                  <li key={tool.id} className="p-4 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition flex items-center justify-between cursor-pointer group">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-slate-800 flex items-center justify-center group-hover:bg-primary-50 dark:group-hover:bg-primary-900/20 transition-colors">
                        <FileSpreadsheet className="w-4 h-4 text-gray-500 group-hover:text-primary-600 dark:group-hover:text-primary-400" />
                      </div>
                      <span className="font-semibold text-sm text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">{tool.name}</span>
                    </div>
                    <span className="text-xs text-gray-500 font-medium">{tool.date}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

        </div>

        {/* Sidebar / Fleet Overview */}
        <div className="space-y-6">
          <section className="bg-gradient-to-br from-primary-600 to-indigo-700 rounded-3xl p-6 text-white shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Truck className="w-32 h-32" />
            </div>
            <h3 className="text-lg font-black mb-1 relative z-10">Fleet Overview</h3>
            <p className="text-primary-100 text-sm mb-6 relative z-10 font-medium">Quick stats from My Fleet</p>
            
            <div className="grid grid-cols-2 gap-4 relative z-10">
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4">
                <div className="text-3xl font-black mb-1">24</div>
                <div className="text-xs text-primary-100 font-semibold">Active Trucks</div>
              </div>
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4">
                <div className="text-3xl font-black mb-1">86%</div>
                <div className="text-xs text-primary-100 font-semibold">Avg Load Factor</div>
              </div>
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 col-span-2 flex items-center justify-between">
                <div>
                  <div className="text-xl font-black mb-1">12</div>
                  <div className="text-xs text-primary-100 font-semibold">Idle Trailers</div>
                </div>
                <button className="text-xs font-bold bg-white text-primary-700 px-3 py-1.5 rounded-full hover:bg-primary-50 transition">
                  Manage
                </button>
              </div>
            </div>
          </section>

          <section className="bg-white dark:bg-dark-card rounded-2xl p-6 border border-gray-100 dark:border-dark-border shadow-sm">
             <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4 uppercase tracking-wider">Suggested Templates</h3>
             <div className="space-y-3">
                {['Invoice Generator', 'Dispatch Notification', 'Driver Manifest'].map((item, i) => (
                  <div key={i} className="flex flex-col gap-1.5 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800 transition cursor-pointer border border-transparent hover:border-gray-200 dark:hover:border-dark-border">
                    <div className="flex items-center gap-2">
                       <LayoutTemplate className="w-4 h-4 text-primary-500" />
                       <span className="font-bold text-sm text-gray-900 dark:text-white">{item}</span>
                    </div>
                    <p className="text-xs text-gray-500 line-clamp-1">Quickly generate standardized {item.toLowerCase()}s from messy data.</p>
                  </div>
                ))}
             </div>
          </section>
        </div>

      </div>
    </div>
  );
}
