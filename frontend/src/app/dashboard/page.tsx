import { AlertCircle, FileText, Star, Truck } from 'lucide-react';

export default function DashboardPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fade-in">
      <h1 className="text-2xl font-bold mb-6 dark:text-white">Home Dashboard</h1>

      {/* Ads Mockup for Non-subscribers */}
      <div className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-dark-border w-full h-24 flex items-center justify-center text-slate-500 text-sm italic rounded-xl">
        Advertisement Banner
      </div>

      {/* Smart Freight Alerts Widget */}
      <section className="saas-card bg-primary-50/50 dark:bg-primary-900/10 border-primary-100 dark:border-primary-900">
        <div className="flex items-center space-x-2 text-primary-800 dark:text-primary-400 font-bold mb-4">
          <AlertCircle className="w-6 h-6" />
          <h2>Smart Freight Alerts</h2>
        </div>
        <div className="bg-white dark:bg-dark-card p-4 rounded-xl shadow-sm border border-slate-100 dark:border-dark-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="font-bold text-lg dark:text-white flex items-center gap-2">Ljubljana → Munich <span className="bg-primary-100 text-primary-800 dark:bg-primary-900/50 dark:text-primary-300 text-xs px-2 py-1 rounded-md border border-primary-200 dark:border-primary-800">Match: 85</span></div>
            <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">Pickup: Celje | Delivery: Salzburg | Detour: <span className="font-semibold text-secondary">+12.5km</span></div>
            <div className="text-sm font-medium mt-1 dark:text-slate-300">Cargo: 1200kg | Est. Revenue: <span className="text-primary-600 dark:text-primary-400">+150€</span></div>
          </div>
          <div className="flex space-x-2 w-full sm:w-auto">
            <button className="flex-1 sm:flex-none px-4 py-2 border dark:border-dark-border rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition font-medium">Ignore</button>
            <button className="flex-1 sm:flex-none px-4 py-2 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition font-semibold shadow-sm">Accept Load</button>
          </div>
        </div>
      </section>

      {/* Overviews */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="saas-card flex flex-col items-center justify-center py-8">
           <Truck className="w-10 h-10 text-primary-500 mb-3"/>
           <h3 className="font-semibold text-slate-700 dark:text-slate-300">Active Shipments / Capacity</h3>
           <p className="text-4xl font-black mt-2 text-slate-900 dark:text-white">4</p>
        </div>
        <div className="saas-card flex flex-col items-center justify-center py-8">
           <FileText className="w-10 h-10 text-slate-400 dark:text-slate-500 mb-3"/>
           <h3 className="font-semibold text-slate-700 dark:text-slate-300">Recent Documents</h3>
           <p className="text-4xl font-black mt-2 text-slate-900 dark:text-white">12</p>
        </div>
        <div className="saas-card flex flex-col items-center justify-center py-8">
           <Star className="w-10 h-10 text-yellow-500 mb-3"/>
           <h3 className="font-semibold text-slate-700 dark:text-slate-300">My Rating</h3>
           <p className="text-4xl font-black mt-2 text-slate-900 dark:text-white">4.9</p>
        </div>
      </div>
    </div>
  )
}
