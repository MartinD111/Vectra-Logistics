'use client';

import React, { useState } from 'react';

/**
 * MOCK DATA
 */
const PENDING_SHIPMENTS = [
  { id: 'shp_1', origin: 'Berlin, DE', dest: 'Munich, DE', weight: '24.0t', type: 'Pallets', temp: null },
  { id: 'shp_2', origin: 'Paris, FR', dest: 'Lyon, FR', weight: '12.5t', type: 'Refrigerated', temp: '-18°C' },
  { id: 'shp_3', origin: 'Milan, IT', dest: 'Rome, IT', weight: '8.0t', type: 'Cars', temp: null },
  { id: 'shp_4', origin: 'Warsaw, PL', dest: 'Krakow, PL', weight: '18.2t', type: 'Live Cargo', temp: '18°C' },
];

const AVAILABLE_FLEET = [
  { id: 'trk_1', name: 'Scania R500 (Dry Van)', status: 'Available', location: 'Berlin HQ', type: 'dry_van' },
  { id: 'trk_2', name: 'Volvo FH16 (Reefer)', status: 'On Route', location: 'A9 Highway', type: 'reefer' },
  { id: 'trk_3', name: 'Mercedes Actros (Car Carrier)', status: 'Available', location: 'Milan Depot', type: 'car_carrier' },
  { id: 'trk_4', name: 'DAF XF (Livestock)', status: 'Available', location: 'Warsaw Farm', type: 'livestock' },
];

/**
 * Trailer Visualizer Component
 */
const TrailerVisualizer = ({ truck, onClose }: { truck: any, onClose: () => void }) => {
  const [viewMode, setViewMode] = useState<'2d-top' | '2d-side' | '3d-iso'>('3d-iso');

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm transition-opacity">
      <div className="w-[800px] h-full bg-[#0a0f1a] border-l border-slate-800 shadow-2xl flex flex-col animate-slide-in">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-[#0d1322]">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-white">{truck.name}</h2>
            <p className="text-sm text-slate-400 mt-1 flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Visual Load Optimizer Active</span>
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            ✕
          </button>
        </div>

        {/* View Toggles */}
        <div className="p-4 flex justify-between items-center bg-[#0d1322]/50 border-b border-slate-800/50">
          <div className="flex space-x-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
            {['2d-top', '2d-side', '3d-iso'].map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode as any)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ${
                  viewMode === mode 
                    ? 'bg-indigo-600 text-white shadow-lg' 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                {mode === '2d-top' && 'Top (2D)'}
                {mode === '2d-side' && 'Side (2D)'}
                {mode === '3d-iso' && 'Isometric (3D)'}
              </button>
            ))}
          </div>

          <div className="flex space-x-4">
             <div className="text-right">
                <p className="text-xs text-slate-500 uppercase tracking-wider">Payload</p>
                <p className="text-emerald-400 font-mono text-sm">4.2t / 24.0t</p>
             </div>
             <div className="text-right">
                <p className="text-xs text-slate-500 uppercase tracking-wider">Capacity</p>
                <p className="text-emerald-400 font-mono text-sm">3 / 33 LDM</p>
             </div>
          </div>
        </div>

        {/* Dynamic Compliance Panels (Livestock specific) */}
        {truck.type === 'livestock' && (
          <div className="px-6 py-4 flex gap-4 bg-orange-950/20 border-b border-orange-900/30">
            <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-3 flex-1 flex flex-col justify-center">
              <span className="text-xs text-orange-400/80 uppercase tracking-wider font-semibold">Ventilation Status</span>
              <span className="text-orange-300 font-medium text-lg flex items-center gap-2">
                <svg className="w-4 h-4 animate-spin-slow" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Active (3 Levels)
              </span>
            </div>
            <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-3 flex-1 flex flex-col justify-center">
              <span className="text-xs text-orange-400/80 uppercase tracking-wider font-semibold">Current Temp</span>
              <span className="text-orange-300 font-medium text-lg">18°C</span>
            </div>
            <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-3 flex-1 flex flex-col justify-center">
              <span className="text-xs text-orange-400/80 uppercase tracking-wider font-semibold">Mandatory Water Stop</span>
              <span className="text-orange-300 font-medium text-lg">2h 15m remaining</span>
            </div>
          </div>
        )}

        {/* 3D / 2D Canvas Area */}
        <div className="flex-1 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-800 via-[#0a0f1a] to-[#05080f] overflow-hidden relative flex items-center justify-center p-8">
          
          {/* Grid Background overlay for tech feel */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none"></div>

          <div 
            className={`w-[200px] h-[500px] bg-slate-800/80 backdrop-blur-md border-2 border-slate-600 rounded-sm relative transition-all duration-700 ease-in-out shadow-[0_0_50px_rgba(79,70,229,0.15)] flex flex-col gap-2 p-2`}
            style={{
              transformStyle: 'preserve-3d',
              transform: 
                viewMode === '3d-iso' ? 'perspective(1200px) rotateX(60deg) rotateZ(-40deg) scale(0.9) translateY(-100px)' :
                viewMode === '2d-side' ? 'perspective(1200px) rotateY(-80deg) scale(1.1)' :
                'perspective(1200px) rotateX(0deg) rotateZ(0deg) scale(1)'
            }}
          >
            {/* Fake LDM Slots */}
            <div className="w-full flex-1 border border-dashed border-slate-500/40 rounded flex flex-col items-center justify-center relative group cursor-crosshair hover:bg-indigo-500/10 transition-colors">
              <span className="text-slate-500 font-mono text-sm group-hover:text-amber-400 transition-colors">Drop Zone 1</span>
              
              {/* Fake payload object */}
              <div 
                className="absolute inset-[10%] bg-indigo-500/20 backdrop-blur-sm border border-indigo-500/50 rounded flex items-center justify-center shadow-[inset_0_0_20px_rgba(99,102,241,0.2)]"
                style={{ transform: 'translateZ(20px)' }}
              >
                 <span className="text-indigo-300 font-mono text-xs">PALLET #A1</span>
              </div>
            </div>
            <div className="w-full flex-1 border border-dashed border-slate-500/40 rounded flex flex-col items-center justify-center cursor-crosshair hover:bg-indigo-500/10 transition-colors">
              <span className="text-slate-500 font-mono text-sm">Drop Zone 2</span>
            </div>
            <div className="w-full flex-1 border border-dashed border-slate-500/40 rounded flex flex-col items-center justify-center cursor-crosshair hover:bg-indigo-500/10 transition-colors">
              <span className="text-slate-500 font-mono text-sm">Drop Zone 3</span>
            </div>

            {/* Simulated Depth Side Walls for 3D */}
            <div className="absolute top-0 right-full w-[40px] h-full bg-slate-700 origin-right transition-opacity duration-300" 
                 style={{ transform: 'rotateY(-90deg)', opacity: viewMode === '3d-iso' ? 1 : 0 }}></div>
            <div className="absolute bottom-full left-0 w-full h-[40px] bg-slate-600 origin-bottom transition-opacity duration-300"
                 style={{ transform: 'rotateX(90deg)', opacity: viewMode === '3d-iso' ? 1 : 0 }}></div>
          </div>
          
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-slate-800 bg-[#0d1322] flex justify-end gap-4">
          <button onClick={onClose} className="px-6 py-2.5 rounded-lg font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors">
            Cancel
         </button>
          <button className="px-6 py-2.5 rounded-lg font-medium text-white bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-500/25 transition-all">
            Confirm Load Plan
          </button>
        </div>
      </div>
    </div>
  );
};


export default function SmartDispatchBoard() {
  const [selectedTruck, setSelectedTruck] = useState<any | null>(null);

  return (
    <div className="min-h-screen bg-[#05080f] text-slate-200 p-8 flex flex-col font-sans selection:bg-indigo-500/30">
      
      {/* Header */}
      <header className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-white mb-2 flex items-center gap-3">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-cyan-400">Smart Dispatch</span> Board
          </h1>
          <p className="text-slate-400 font-medium">Drag and drop shipments onto available vehicles. Click a vehicle for 3D load planning.</p>
        </div>
        <div className="flex gap-4">
           <button className="bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-lg font-medium transition-colors border border-slate-700">Settings</button>
           <button className="bg-indigo-600 hover:bg-indigo-500 shadow-[0_0_15px_rgba(79,70,229,0.3)] px-4 py-2 rounded-lg font-medium text-white transition-all">Auto-Assign AI</button>
        </div>
      </header>

      {/* Main Board */}
      <div className="flex-1 flex gap-8 h-full">
        
        {/* Left Column: Pending Shipments */}
        <div className="w-1/3 flex flex-col gap-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-bold text-white tracking-wide uppercase">Pending Shipments</h2>
            <span className="bg-slate-800 text-slate-300 text-xs px-2.5 py-1 rounded-full font-bold">{PENDING_SHIPMENTS.length} total</span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
            {PENDING_SHIPMENTS.map((shipment) => (
              <div 
                key={shipment.id} 
                className="bg-[#0f1523] border border-slate-800 rounded-xl p-5 hover:border-indigo-500/50 hover:shadow-[0_0_20px_rgba(79,70,229,0.1)] transition-all cursor-grab group relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-indigo-500/10 to-transparent pointer-events-none rounded-bl-3xl"></div>
                
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-slate-500">#{shipment.id.toUpperCase()}</span>
                    <span className="bg-indigo-500/10 text-indigo-400 text-xs px-2 py-0.5 rounded border border-indigo-500/20 font-medium">
                      {shipment.type}
                    </span>
                    {shipment.temp && (
                      <span className="bg-cyan-500/10 text-cyan-400 text-xs px-2 py-0.5 rounded border border-cyan-500/20 font-medium">
                        {shipment.temp}
                      </span>
                    )}
                  </div>
                  <span className="text-slate-300 font-mono font-medium">{shipment.weight}</span>
                </div>

                <div className="flex items-center justify-between mt-4">
                   <div className="flex flex-col">
                      <span className="text-xs text-slate-500 uppercase font-semibold tracking-wider">Origin</span>
                      <span className="text-white font-medium mt-0.5">{shipment.origin}</span>
                   </div>
                   <div className="px-4 text-slate-600">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                   </div>
                   <div className="flex flex-col text-right">
                      <span className="text-xs text-slate-500 uppercase font-semibold tracking-wider">Destination</span>
                      <span className="text-white font-medium mt-0.5">{shipment.dest}</span>
                   </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Center/Right: Available Fleet */}
        <div className="w-2/3 flex flex-col gap-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-bold text-white tracking-wide uppercase">Available Fleet</h2>
            <div className="flex gap-2">
               <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs px-2.5 py-1 rounded-full font-bold">3 Online</span>
               <span className="bg-slate-800 text-slate-400 text-xs px-2.5 py-1 rounded-full font-bold">Filters ▾</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {AVAILABLE_FLEET.map((truck) => (
              <div 
                key={truck.id}
                onClick={() => setSelectedTruck(truck)}
                className="bg-[#0f1523] border border-slate-800 rounded-xl p-5 hover:border-slate-600 hover:bg-[#131a2b] transition-all cursor-pointer relative group flex flex-col justify-between min-h-[160px]"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-xl"></div>
                
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-bold text-white mb-1">{truck.name}</h3>
                    <p className="text-sm text-slate-500 flex items-center gap-1.5">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      {truck.location}
                    </p>
                  </div>
                  <div className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                    truck.status === 'Available' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  }`}>
                    {truck.status}
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-800 flex justify-between items-end">
                   <div className="flex -space-x-2">
                     <div className="w-8 h-8 rounded-full bg-slate-800 border-2 border-[#0f1523] flex items-center justify-center text-xs font-medium text-slate-400">1</div>
                     <div className="w-8 h-8 rounded-full bg-slate-800 border-2 border-[#0f1523] flex items-center justify-center text-xs font-medium text-slate-400">2</div>
                     <div className="w-8 h-8 rounded-full bg-slate-800 border-2 border-[#0f1523] border-dashed flex items-center justify-center text-xs font-medium text-slate-500">+</div>
                   </div>
                   <div className="text-indigo-400 text-sm font-medium group-hover:underline flex items-center gap-1">
                      Open Optimizer
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                   </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex-1 border-2 border-dashed border-slate-800 rounded-xl flex items-center justify-center text-slate-500 bg-slate-900/20 hover:bg-slate-900/40 transition-colors cursor-pointer">
            <div className="flex flex-col items-center gap-2">
              <svg className="w-8 h-8 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="font-medium">Add External Carrier</span>
            </div>
          </div>
        </div>
      </div>

      {selectedTruck && (
        <TrailerVisualizer truck={selectedTruck} onClose={() => setSelectedTruck(null)} />
      )}

      {/* Basic Global CSS included for some custom animations & scrollbar */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes slide-in {
          0% { transform: translateX(100%); }
          100% { transform: translateX(0); }
        }
        .animate-slide-in {
          animation: slide-in 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: #334155;
          border-radius: 10px;
        }
      `}} />
    </div>
  );
}
