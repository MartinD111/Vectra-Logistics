'use client';

export default function PostShipmentPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 animate-fade-in">
      <h1 className="text-2xl font-bold mb-6 dark:text-white">Post New Shipment</h1>
      
      <div className="saas-card">
        <form className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Pickup Location</label>
              <input type="text" className="saas-input" placeholder="Address or City" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Delivery Location</label>
              <input type="text" className="saas-input" placeholder="Address or City" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Cargo Weight (kg)</label>
              <input type="number" className="saas-input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Volume (m³)</label>
              <input type="number" step="0.1" className="saas-input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Pallet Count</label>
              <input type="number" className="saas-input" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Pickup Window Start</label>
              <input type="datetime-local" className="saas-input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Delivery Deadline</label>
              <input type="datetime-local" className="saas-input" />
            </div>
          </div>

           <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Cargo Type</label>
              <input type="text" className="saas-input" placeholder="e.g. Electronics, Furniture" />
            </div>

          <div className="pt-6 border-t dark:border-dark-border">
            <button type="button" className="saas-button py-4 text-lg">
               Find Matching Trucks
            </button>
          </div>
        </form>
      </div>

       {/* Demo Results Panel */}
       <div className="mt-8 border-t pt-8 hidden">
         <h2 className="text-xl font-bold mb-4 dark:text-white">Matching Trucks</h2>
         {/* Mapping logic here */}
       </div>
    </div>
  )
}
