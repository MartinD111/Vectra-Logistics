'use client';

import React, { useState } from 'react';

export default function AIParserPage() {
  const [dragActive, setDragActive] = useState(false);
  const [processingState, setProcessingState] = useState<'idle' | 'processing' | 'complete'>('idle');

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      simulateProcessing();
    }
  };

  const handleManualUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      simulateProcessing();
    }
  };

  const simulateProcessing = () => {
    setProcessingState('processing');
    setTimeout(() => {
      setProcessingState('complete');
    }, 2500); // 2.5s faux loading
  };

  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-[#09090b] text-slate-900 dark:text-slate-100 p-8 font-sans transition-colors">
      
      <header className="mb-10 max-w-6xl mx-auto">
        <h1 className="text-3xl font-extrabold tracking-tight flex items-center justify-between">
          <span className="flex items-center gap-3">
             <span className="bg-emerald-500/10 text-emerald-500 p-2 rounded-lg">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
             </span>
             AI Rate Confirmation Parser
          </span>
          {processingState === 'complete' && (
             <button onClick={() => setProcessingState('idle')} className="text-sm font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors">
               Reset Form
             </button>
          )}
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-2 ml-11">Automatically extract payload, routes, and billing from carrier PDF forms.</p>
      </header>

      <div className="max-w-6xl mx-auto flex flex-col gap-8">
        
        {/* Top Dropzone */}
        {processingState !== 'complete' && (
          <div 
            className={`w-full h-64 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center transition-all relative overflow-hidden ${
              dragActive 
                ? 'border-emerald-500 bg-emerald-500/5 dark:bg-emerald-500/10 scale-[1.01]' 
                : 'border-slate-300 dark:border-slate-800 bg-white dark:bg-[#121214] hover:border-emerald-400 dark:hover:border-emerald-500/50'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            {processingState === 'idle' ? (
              <>
                <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4 transition-transform group-hover:scale-110">
                  <svg className="w-8 h-8 text-slate-400 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold mb-1">Drag & Drop Rate Confirmation</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">PDF, PNG, JPG (max 10MB)</p>
                <label className="bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 px-6 py-2.5 rounded-lg font-medium cursor-pointer shadow-sm hover:shadow transition-all">
                  Browse Files
                  <input type="file" className="hidden" accept=".pdf,image/*" onChange={handleManualUpload}/>
                </label>
              </>
            ) : (
               <div className="flex flex-col items-center">
                  {/* Scanner Animation */}
                  <div className="relative w-32 h-40 bg-slate-100 dark:bg-slate-800 rounded mb-6 overflow-hidden border border-slate-200 dark:border-slate-700 shadow-inner">
                     <div className="absolute top-0 left-0 w-full h-[2px] bg-emerald-500 shadow-[0_0_15px_#10b981] animate-scan"></div>
                     <div className="p-3 space-y-2">
                        <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded w-3/4"></div>
                        <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded w-full"></div>
                        <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded w-5/6"></div>
                        <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded w-1/2"></div>
                     </div>
                  </div>
                  <h3 className="text-lg font-semibold animate-pulse text-emerald-600 dark:text-emerald-400">Extracting Data using Vectra AI...</h3>
               </div>
            )}
          </div>
        )}

        {/* Results View */}
        {processingState === 'complete' && (
          <div className="flex gap-8 animate-fade-in items-start">
            
            {/* Column 1: Document Preview */}
            <div className="w-1/2 sticky top-8">
               <div className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-slate-800 p-8 rounded-2xl shadow-sm aspect-[1/1.4] relative overflow-hidden">
                 {/* Visual Highlighting overlays simulated */}
                 <div className="absolute top-[120px] left-[32px] right-[32px] h-[40px] bg-emerald-500/10 border border-emerald-500/30 rounded"></div>
                 <div className="absolute top-[280px] left-[32px] w-[200px] h-[30px] bg-emerald-500/10 border border-emerald-500/30 rounded"></div>
                 <div className="absolute top-[380px] left-[32px] w-[180px] h-[30px] bg-emerald-500/10 border border-emerald-500/30 rounded"></div>
                 <div className="absolute bottom-[100px] right-[32px] w-[150px] h-[40px] bg-emerald-500/10 border border-emerald-500/30 rounded"></div>

                 {/* Fake PDF Content */}
                 <div className="flex justify-between items-start mb-12 border-b border-slate-200 dark:border-slate-700 pb-6">
                    <div className="w-32 h-10 bg-slate-200 dark:bg-slate-800 rounded"></div>
                    <div className="text-right">
                       <div className="h-6 w-40 bg-slate-200 dark:bg-slate-800 rounded mb-2 ml-auto"></div>
                       <div className="h-4 w-32 bg-slate-100 dark:bg-slate-800/50 rounded ml-auto"></div>
                    </div>
                 </div>
                 
                 <div className="space-y-6">
                    <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded border border-slate-100 dark:border-slate-800">
                       <div className="h-4 w-24 bg-slate-300 dark:bg-slate-700 rounded mb-3"></div>
                       <div className="h-3 w-64 bg-slate-200 dark:bg-slate-800 rounded mb-2"></div>
                       <div className="h-3 w-48 bg-slate-200 dark:bg-slate-800 rounded"></div>
                    </div>

                    <div className="space-y-3">
                       <div className="h-4 w-full bg-slate-100 dark:bg-slate-800 rounded"></div>
                       <div className="h-4 w-full bg-slate-100 dark:bg-slate-800 rounded"></div>
                       <div className="h-4 w-3/4 bg-slate-100 dark:bg-slate-800 rounded"></div>
                    </div>
                 </div>
               </div>
            </div>

            {/* Column 2: Extracted Data Form */}
            <div className="w-1/2 bg-white dark:bg-[#121214] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl shadow-slate-200/40 dark:shadow-none p-8 flex flex-col gap-6 relative">
               
               <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                 <h2 className="text-xl font-bold">Extracted Details</h2>
                 <span className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5">
                   <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                   High Confidence
                 </span>
               </div>

               {/* Form Fields */}
               <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest flex items-center gap-1">
                           Reference ID
                           <SparklesIcon />
                        </label>
                        <input type="text" readOnly value="LKW-2024-8842" className="w-full bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/50 rounded-lg px-4 py-2.5 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-shadow outline-none shadow-[0_0_15px_rgba(16,185,129,0.05)]"/>
                     </div>
                     <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest flex items-center gap-1">
                           Customer
                           <SparklesIcon />
                        </label>
                        <input type="text" readOnly value="Logistics Corp GmbH" className="w-full bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/50 rounded-lg px-4 py-2.5 text-slate-900 dark:text-slate-100 focus:outline-none outline-none shadow-[0_0_15px_rgba(16,185,129,0.05)]"/>
                     </div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
                     <h3 className="text-sm font-bold mb-3 text-slate-800 dark:text-slate-200">Route Information</h3>
                     <div className="relative pl-6 space-y-6">
                        {/* Vertical line connecting pickup/delivery */}
                        <div className="absolute left-[7px] top-4 bottom-4 w-0.5 bg-slate-200 dark:bg-slate-700"></div>
                        
                        <div className="relative">
                           <div className="absolute -left-[30px] top-1 w-4 h-4 rounded-full border-4 border-white dark:border-[#121214] bg-indigo-500"></div>
                           <div className="space-y-1.5">
                              <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest flex items-center gap-1">
                                 Pickup Location <SparklesIcon />
                              </label>
                              <input type="text" readOnly value="Berlin, DE (10115)" className="w-full bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/50 rounded-lg px-4 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none"/>
                           </div>
                        </div>
                        <div className="relative">
                           <div className="absolute -left-[30px] top-1 w-4 h-4 rounded-full border-4 border-white dark:border-[#121214] bg-emerald-500"></div>
                           <div className="space-y-1.5">
                              <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest flex items-center gap-1">
                                 Delivery Location <SparklesIcon />
                              </label>
                              <input type="text" readOnly value="Munich, DE (80331)" className="w-full bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/50 rounded-lg px-4 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none"/>
                           </div>
                        </div>
                     </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest flex items-center gap-1">
                           Weight <SparklesIcon />
                        </label>
                        <input type="text" readOnly value="24,500 KG" className="w-full bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/50 rounded-lg px-4 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none"/>
                     </div>
                     <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest flex items-center gap-1">
                           Total Rate <SparklesIcon />
                        </label>
                        <input type="text" readOnly value="€ 1,250.00" className="w-full bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-400 dark:border-emerald-500 rounded-lg px-4 py-2 font-bold text-slate-900 dark:text-white outline-none ring-2 ring-emerald-500/20"/>
                     </div>
                  </div>
               </div>

               <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                  <button className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 px-8 py-3 rounded-xl font-bold shadow-lg shadow-slate-200 dark:shadow-none transition-all flex items-center gap-2">
                     Save Shipment
                     <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                     </svg>
                  </button>
               </div>
            </div>
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes fade-in {
          0% { opacity: 0; transform: translateY(10px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.4s ease-out forwards;
        }
        @keyframes scan {
          0% { transform: translateY(0); }
          50% { transform: translateY(160px); }
          100% { transform: translateY(0); }
        }
        .animate-scan {
          animation: scan 1.5s ease-in-out infinite;
        }
      `}} />
    </div>
  );
}

const SparklesIcon = () => (
  <svg className="w-3 h-3 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
);
