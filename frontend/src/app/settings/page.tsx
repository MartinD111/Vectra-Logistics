'use client';

import { useTheme } from 'next-themes';
import { Moon, Sun, Monitor, Bell, Globe, Lock } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch
  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <h1 className="text-2xl font-bold dark:text-white">Account Settings</h1>

      {/* Theme Settings */}
      <div className="saas-card">
        <h3 className="text-lg font-bold flex items-center gap-2 mb-2 dark:text-white">
           <Monitor size={20} className="text-primary-500" /> UI Preferences
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 border-b pb-4 dark:border-dark-border border-gray-100">
           Customize your viewing experience based on your environment.
        </p>
        
        <div className="flex flex-wrap gap-4">
          <button 
            onClick={() => setTheme('light')}
            className={`flex items-center gap-3 px-6 py-4 rounded-xl border-2 transition-all ${
              theme === 'light' ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400' : 'border-gray-200 dark:border-dark-border hover:border-primary-300 dark:text-white'
            }`}
          >
            <Sun size={24} />
            <span className="font-medium">Light Mode</span>
          </button>
          
          <button 
            onClick={() => setTheme('dark')}
            className={`flex items-center gap-3 px-6 py-4 rounded-xl border-2 transition-all ${
              theme === 'dark' ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400' : 'border-gray-200 dark:border-dark-border hover:border-primary-300 dark:text-white'
            }`}
          >
            <Moon size={24} />
            <span className="font-medium">Dark Mode</span>
          </button>

          <button 
            onClick={() => setTheme('system')}
            className={`flex items-center gap-3 px-6 py-4 rounded-xl border-2 transition-all ${
              theme === 'system' ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400' : 'border-gray-200 dark:border-dark-border hover:border-primary-300 dark:text-white'
            }`}
          >
            <Monitor size={24} />
            <span className="font-medium">System Default</span>
          </button>
        </div>
      </div>

      {/* Notification Preferences */}
      <div className="saas-card">
         <h3 className="text-lg font-bold flex items-center gap-2 mb-2 dark:text-white">
           <Bell size={20} className="text-blue-500" /> Smart Freight Notifications
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 border-b pb-4 dark:border-dark-border border-gray-100">
           Manage how VECTRA alerts you about route matches and new capacity.
        </p>

        <div className="space-y-4">
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Active Dashboard Alerts</span>
            <div className="relative inline-block w-12 mr-2 align-middle select-none transition duration-200 ease-in">
                <input type="checkbox" name="toggle" id="toggle1" className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer" defaultChecked />
                <label htmlFor="toggle1" className="toggle-label block overflow-hidden h-6 rounded-full bg-primary-500 cursor-pointer"></label>
            </div>
          </label>
           <label className="flex items-center justify-between cursor-pointer">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Email Digest (Daily)</span>
            <div className="relative inline-block w-12 mr-2 align-middle select-none transition duration-200 ease-in">
                <input type="checkbox" name="toggle" id="toggle2" className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer" defaultChecked />
                <label htmlFor="toggle2" className="toggle-label block overflow-hidden h-6 rounded-full bg-primary-500 cursor-pointer"></label>
            </div>
          </label>
        </div>
      </div>

      {/* Language & Security */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="saas-card">
           <h3 className="text-lg font-bold flex items-center gap-2 mb-4 dark:text-white border-b pb-4 dark:border-dark-border">
             <Globe size={20} className="text-slate-500" /> Language
          </h3>
          <select className="saas-input bg-white cursor-pointer">
             <option>English (US)</option>
             <option>German (DE)</option>
             <option>Slovenian (SI)</option>
          </select>
        </div>
        
        <div className="saas-card">
           <h3 className="text-lg font-bold flex items-center gap-2 mb-4 dark:text-white border-b pb-4 dark:border-dark-border">
             <Lock size={20} className="text-red-500" /> Password Check
          </h3>
          <button className="saas-button bg-slate-800 hover:bg-slate-700 text-white">
             Change Password
          </button>
        </div>
      </div>
    </div>
  )
}
