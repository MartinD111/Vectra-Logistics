import { CreditCard, ShieldCheck, CheckCircle2 } from 'lucide-react';

export default function BillingPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div className="flex items-center gap-3 border-b pb-4 dark:border-dark-border">
         <CreditCard size={28} className="text-primary-500" />
         <h1 className="text-2xl font-bold dark:text-white">Billing & Subscription</h1>
      </div>

      {/* Current Status */}
      <div className="saas-card bg-gradient-to-r from-primary-50/50 to-transparent dark:from-primary-900/10">
        <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Current Plan</h2>
        <div className="flex items-center gap-4">
           <span className="bg-primary-100 text-primary-800 dark:bg-primary-900 dark:text-primary-300 px-3 py-1 rounded-full text-sm font-bold border border-primary-200 dark:border-primary-800">
             Active Subscriber
           </span>
           <span className="text-sm text-gray-500 dark:text-gray-400">
             Next billing cycle: Nov 1, 2026
           </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
         {/* Subscriber Details */}
         <div className="saas-card ring-2 ring-primary-500 relative">
            <div className="absolute top-0 right-0 bg-primary-500 text-white px-3 py-1 rounded-bl-lg rounded-tr-xl text-xs font-bold uppercase tracking-wide">
               Active
            </div>
            <ShieldCheck size={32} className="text-primary-500 mb-4" />
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Subscriber</h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-6">Professional fleet optimization.</p>
            
            <div className="text-5xl font-extrabold text-gray-900 dark:text-white mb-1">3%</div>
            <div className="text-gray-500 dark:text-gray-400 text-sm mb-6">commission per transport (min 15€)</div>
            
            <ul className="space-y-3 mb-8">
               <li className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <CheckCircle2 size={16} className="text-primary-500" /> No advertisements
               </li>
               <li className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <CheckCircle2 size={16} className="text-primary-500" /> Full CRM Helper features
               </li>
               <li className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <CheckCircle2 size={16} className="text-primary-500" /> Priority algorithm matching
               </li>
            </ul>

            <button className="saas-button bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-700 dark:text-white dark:hover:bg-slate-600" disabled>
               Current Plan
            </button>
         </div>

         {/* Non-Subscriber Details */}
         <div className="saas-card opacity-75 hover:opacity-100 transition-opacity">
            <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-700 mb-4"></div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Non-Subscriber</h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-6">Free to join, pay per match.</p>
            
            <div className="text-5xl font-extrabold text-gray-900 dark:text-white mb-1">6%</div>
            <div className="text-gray-500 dark:text-gray-400 text-sm mb-6">commission per transport (min 25€)</div>
            
            <ul className="space-y-3 mb-8">
               <li className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <div className="h-4 w-4 rounded-full border-2 border-gray-300 dark:border-gray-600" /> Ad-supported platform
               </li>
               <li className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <div className="h-4 w-4 rounded-full border-2 border-gray-300 dark:border-gray-600" /> Basic Marketplace access
               </li>
            </ul>

            <button className="saas-button bg-white text-primary-600 border-2 border-primary-600 hover:bg-primary-50 dark:bg-transparent dark:text-primary-400 dark:border-primary-500 dark:hover:bg-primary-900/20">
               Downgrade Plan
            </button>
         </div>
      </div>
    </div>
  )
}
