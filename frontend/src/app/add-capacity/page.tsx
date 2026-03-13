'use client';

export default function AddCapacityPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col md:flex-row gap-8 animate-fade-in">
      <div className="flex-1">
        <h1 className="text-2xl font-bold mb-6 dark:text-white">Publish Truck Capacity</h1>
        <div className="saas-card">
          <form className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Origin / Start Location</label>
                <input type="text" className="saas-input" placeholder="Address or City" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Destination Location</label>
                <input type="text" className="saas-input" placeholder="Address or City" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Available Weight (kg)</label>
                <input type="number" className="saas-input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Available Vol (m³)</label>
                <input type="number" step="0.1" className="saas-input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Pallet Spaces</label>
                <input type="number" className="saas-input" />
              </div>
            </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Departure Time</label>
                <input type="datetime-local" className="saas-input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Delivery Deadline</label>
                <input type="datetime-local" className="saas-input" />
              </div>
            </div>

             <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Vehicle Type</label>
                <select className="saas-input">
                  <option>Standard Trailer</option>
                  <option>Refrigerated (Reefer)</option>
                  <option>Flatbed</option>
                  <option>Box Truck</option>
                </select>
              </div>

            <div className="pt-6 border-t dark:border-dark-border">
              <button type="button" className="saas-button py-4 text-lg">
                 Publish to Marketplace
              </button>
            </div>
          </form>
        </div>
      </div>
      
      {/* Route Preview stub */}
      <div className="w-full md:w-80">
         <h2 className="text-lg font-bold mb-4 dark:text-white">Route Preview</h2>
         <div className="bg-slate-100 dark:bg-dark-card dark:border-dark-border h-64 rounded-2xl flex items-center justify-center border font-medium text-slate-500 shadow-sm">
            Map Render Here
         </div>
      </div>
    </div>
  )
}
