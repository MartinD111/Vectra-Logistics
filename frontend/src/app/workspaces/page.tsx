'use client';

import { useState } from 'react';
import DashboardTab from '@/components/workspaces/DashboardTab';
import TemplatesTab from '@/components/workspaces/TemplatesTab';
import ExcelAutomationTool from '@/components/workspaces/ExcelAutomationTool';
import MyFleetTab from '@/components/workspaces/MyFleetTab';
import { Home, FileSpreadsheet, LayoutTemplate, Truck } from 'lucide-react';

const tabs = [
  { id: 'dashboard', name: 'Dashboard', icon: Home, component: DashboardTab },
  { id: 'templates', name: 'Templates', icon: LayoutTemplate, component: TemplatesTab },
  { id: 'excel-tool', name: 'Excel Automation Tool', icon: FileSpreadsheet, component: ExcelAutomationTool },
  { id: 'fleet', name: 'My Fleet', icon: Truck, component: MyFleetTab },
];

export default function WorkspacesPage() {
  const [activeTab, setActiveTab] = useState('dashboard');

  const ActiveComponent = tabs.find(t => t.id === activeTab)?.component || DashboardTab;

  return (
    <div className="min-h-[calc(100vh-80px)] bg-gray-50/50 dark:bg-dark-bg text-gray-900 dark:text-gray-100">
      <div className="max-w-7xl mx-auto px-4 lg:px-8 py-8">
        
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-black tracking-tight text-gray-900 dark:text-white">
            Vectra <span className="text-primary-600 dark:text-primary-400">Workspaces</span>
          </h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 max-w-2xl">
            Your internal automation environment. Build workflows, transform messy Excel data, and streamline your logistics processes.
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="mb-8 border-b border-gray-200 dark:border-dark-border overflow-x-auto no-scrollbar">
          <nav className="-mb-px flex space-x-6 min-w-max" aria-label="Tabs">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    flex items-center gap-2 py-4 px-1 border-b-2 font-bold text-sm transition-colors whitespace-nowrap
                    ${isActive 
                      ? 'border-primary-600 text-primary-600 dark:border-primary-400 dark:text-primary-400' 
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:border-slate-600'}
                  `}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400'}`} />
                  {tab.name}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Main Content Area */}
        <div className="min-h-[500px]">
          <ActiveComponent />
        </div>

      </div>
    </div>
  );
}
