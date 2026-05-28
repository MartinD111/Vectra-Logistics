import React from 'react';

export default function SettlementsComingSoon() {
  return (
    <div className="min-h-screen bg-[#05080f] overflow-hidden relative flex items-center text-slate-200 font-sans selection:bg-indigo-500/30">
      
      {/* Background Decor */}
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-indigo-600/10 blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-cyan-600/10 blur-[120px] pointer-events-none"></div>
      {/* Grid overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none opacity-50"></div>

      <div className="w-full max-w-7xl mx-auto px-8 relative z-10 flex flex-col lg:flex-row items-center gap-16 py-12">
        
        {/* Left Content */}
        <div className="flex-1 space-y-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-semibold text-sm backdrop-blur-md">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
            </span>
            In Active Development
          </div>

          <h1 className="text-5xl lg:text-7xl font-extrabold tracking-tight text-white leading-[1.1]">
            Driver <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-cyan-400 to-emerald-400">Settlements</span>
          </h1>
          
          <p className="text-xl text-slate-400 leading-relaxed max-w-2xl font-light">
            We are engineering the industry's most advanced automated payroll and fuel reconciliation system. Say goodbye to manual spreadsheets.
          </p>

          <ul className="space-y-5 text-slate-300">
             <li className="flex items-start gap-4 bg-white/5 p-4 rounded-xl border border-white/10 glass-panel">
               <div className="bg-indigo-500/20 p-2 rounded-lg text-indigo-400 mt-1">
                 <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                 </svg>
               </div>
               <div>
                 <h3 className="text-white font-bold mb-1">Telematics Integration</h3>
                 <p className="text-slate-400 text-sm">Two-way continuous telematic synchronization with Samsara and Geotab.</p>
               </div>
             </li>
             
             <li className="flex items-start gap-4 bg-white/5 p-4 rounded-xl border border-white/10 glass-panel">
               <div className="bg-cyan-500/20 p-2 rounded-lg text-cyan-400 mt-1">
                 <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                 </svg>
               </div>
               <div>
                 <h3 className="text-white font-bold mb-1">Cost Automation</h3>
                 <p className="text-slate-400 text-sm">Automated fuel cost and toll calculation.</p>
               </div>
             </li>

             <li className="flex items-start gap-4 bg-white/5 p-4 rounded-xl border border-white/10 glass-panel">
               <div className="bg-emerald-500/20 p-2 rounded-lg text-emerald-400 mt-1">
                 <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                 </svg>
               </div>
               <div>
                 <h3 className="text-white font-bold mb-1">Compliance & Reporting</h3>
                 <p className="text-slate-400 text-sm">Instant IFTA tax preparation data. One-click generation of PDF payroll reports combining driven miles and market rates.</p>
               </div>
             </li>
          </ul>

          <div className="pt-6 border-t border-slate-800">
             <label className="block text-sm font-semibold text-slate-300 mb-3">Get Early Access</label>
             <div className="flex gap-3 max-w-md">
                <input 
                  type="email" 
                  placeholder="Enter your email address" 
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all placeholder:text-slate-500"
                />
                <button className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-6 py-3 rounded-lg shadow-[0_0_20px_rgba(79,70,229,0.3)] transition-all flex items-center justify-center whitespace-nowrap">
                  Notify Me
                </button>
             </div>
          </div>
        </div>

        {/* Right Content - Abstract Tech Visual */}
        <div className="flex-1 hidden lg:flex items-center justify-center relative perspective-1000">
           <div className="w-[500px] h-[600px] relative">
              {/* Floating Cards simulating the UI being built */}
              <div className="absolute top-[10%] right-[10%] w-64 h-32 bg-slate-800/80 backdrop-blur-xl border border-slate-700 rounded-2xl shadow-2xl p-4 transform hover:scale-105 hover:-translate-y-2 transition-transform duration-500 float-animation delay-100 style-3d">
                 <div className="h-3 w-20 justify-between items-center bg-slate-700 rounded mb-4"></div>
                 <div className="h-8 w-full bg-indigo-500/20 rounded mb-2"></div>
                 <div className="h-4 w-2/3 bg-slate-600/50 rounded"></div>
              </div>
              <div className="absolute bottom-[20%] left-[5%] w-72 h-40 bg-slate-800/80 backdrop-blur-xl border border-slate-600 rounded-2xl shadow-2xl p-5 transform hover:scale-105 hover:-translate-y-2 transition-transform duration-500 float-animation style-3d-alt">
                 <div className="flex justify-between items-center mb-4 border-b border-slate-700 pb-2">
                    <div className="h-4 w-24 bg-emerald-500/20 rounded"></div>
                    <div className="w-8 h-8 rounded-full bg-slate-700"></div>
                 </div>
                 <div className="h-4 w-full bg-slate-700/50 rounded mb-2"></div>
                 <div className="h-4 w-full bg-slate-700/50 rounded mb-2"></div>
                 <div className="h-4 w-4/5 bg-slate-700/50 rounded"></div>
              </div>

              {/* Main central glow/core */}
              <div className="absolute inset-0 m-auto w-64 h-64 rounded-full bg-gradient-to-tr from-indigo-600 to-cyan-400 opacity-20 blur-3xl animate-pulse"></div>
              <svg className="absolute inset-0 w-full h-full text-slate-800 drop-shadow-2xl" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
                <path fill="var(--tw-gradient-stops)" d="M44.7,-76.4C58.8,-69.2,71.8,-59.1,81.1,-46.3C90.4,-33.5,96,-18.1,95.5,-2.9C95,12.2,88.4,27.1,78.2,39.3C68,51.5,54.2,61,40.1,68.7C26,76.4,11.6,82.3,-3.1,87.6C-17.8,92.9,-32.8,97.6,-45.5,91.4C-58.1,85.2,-68.4,68.1,-76.8,51.8C-85.2,35.5,-91.7,20,-92.3,4.1C-92.9,-11.8,-87.6,-28.1,-78.9,-42.6C-70.2,-57.1,-58.1,-69.8,-43.8,-76.9C-29.5,-84,-13,-85.5,2.4,-89.1C17.8,-92.7,30.6,-83.6,44.7,-76.4Z" transform="translate(100 100)" className="fill-slate-900/50 stroke-slate-800" strokeWidth="1" />
              </svg>
           </div>
        </div>

      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .glass-panel {
          transition: all 0.3s ease;
        }
        .glass-panel:hover {
          background-color: rgba(255, 255, 255, 0.08);
          transform: translateX(5px);
          border-color: rgba(255, 255, 255, 0.2);
        }
        .perspective-1000 {
           perspective: 1000px;
        }
        @keyframes float {
          0%, 100% { transform: translateY(0) rotateX(10deg) rotateY(-10deg); }
          50% { transform: translateY(-15px) rotateX(12deg) rotateY(-8deg); }
        }
        .float-animation {
          animation: float 6s ease-in-out infinite;
        }
        .delay-100 {
          animation-delay: 1.5s;
        }
        .style-3d {
           transform-style: preserve-3d;
           transform: rotateX(10deg) rotateY(-10deg);
        }
        .style-3d-alt {
           transform-style: preserve-3d;
           transform: rotateX(15deg) rotateY(15deg) translateZ(50px);
        }
      `}} />
    </div>
  );
}
