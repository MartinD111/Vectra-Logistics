'use client';

import { useState } from 'react';
import { FileText, Download, CheckSquare, ArrowRight, Package, BookOpen, AlertCircle, History } from 'lucide-react';
import * as XLSX from 'xlsx';

interface Props {
  onContinue: () => void;
}

export default function CmrOnboarding({ onContinue }: Props) {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const handleContinue = () => {
    if (dontShowAgain) localStorage.setItem('hide_cmr_onboarding', 'true');
    onContinue();
  };

  const handleDownloadTemplate = () => {
    const headers = ['Description', 'Marks', 'Quantity', 'Unit', 'Weight(kg)', 'HSCode'];
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'CMR_Goods_Template');
    XLSX.writeFile(wb, 'Vectra_CMR_Template.xlsx');
  };

  return (
    <div className="min-h-[calc(100vh-80px)] bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center p-6">
      <div className="max-w-4xl w-full bg-white dark:bg-slate-900 rounded-3xl shadow-xl overflow-hidden border border-gray-100 dark:border-slate-800 animate-fade-in relative">

        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-primary-500 via-emerald-400 to-blue-500" />

        <div className="p-10">
          {/* Hero */}
          <div className="text-center mb-10">
            <div className="w-20 h-20 bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 rounded-3xl flex items-center justify-center mx-auto mb-5 shadow-sm">
              <FileText className="w-10 h-10" />
            </div>
            <h1 className="text-3xl font-black mb-3 text-gray-900 dark:text-white">
              Welcome to <span className="text-primary-600 dark:text-primary-400">CMR Helper</span>
            </h1>
            <p className="text-base text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
              A flexible tool for generating, printing, and managing international freight CMR documents for any cargo type.
            </p>
          </div>

          {/* Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">

            {/* What is CMR */}
            <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 p-6 rounded-2xl">
              <h3 className="font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2 text-sm">
                <span className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center shrink-0">
                  <BookOpen className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </span>
                What is a CMR Document?
              </h3>
              <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed mb-3">
                The CMR (Convention Relative au Contrat de Transport International de Marchandises par Route) is an international transport contract for road freight, governed by the 1956 CMR Convention.
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500 font-semibold mb-1">A CMR document must contain:</p>
              <ul className="text-xs text-gray-500 dark:text-gray-400 space-y-0.5 list-disc list-inside">
                <li>Description of goods and packaging type</li>
                <li>Number of packages and gross weight</li>
                <li>Customs instructions</li>
                <li>Freight charges and related costs</li>
              </ul>
            </div>

            {/* When CMR does NOT apply */}
            <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 p-6 rounded-2xl">
              <h3 className="font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2 text-sm">
                <span className="w-8 h-8 bg-amber-100 dark:bg-amber-900/30 rounded-lg flex items-center justify-center shrink-0">
                  <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                </span>
                When CMR Does NOT Apply
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-500 font-semibold mb-1">Per Article 5 of the CMR Convention:</p>
              <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1.5">
                <li className="flex gap-2">
                  <span className="text-amber-500 font-bold shrink-0">✗</span>
                  <span><b>Postal shipments</b> — regulated by international postal conventions</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-amber-500 font-bold shrink-0">✗</span>
                  <span><b>Human remains (coffins)</b> — governed by special sanitary regulations</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-amber-500 font-bold shrink-0">✗</span>
                  <span><b>Household / office relocations</b> — not classified as commercial goods transport</span>
                </li>
              </ul>
            </div>

            {/* Data Import */}
            <div className="bg-gray-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700 p-6 rounded-2xl">
              <h3 className="font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2 text-sm">
                <span className="w-8 h-8 bg-gray-100 dark:bg-slate-700 rounded-lg flex items-center justify-center shrink-0">
                  <Package className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                </span>
                Data Import via Excel
              </h3>
              <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed mb-3">
                Import goods from an Excel file using our template. Columns: <span className="font-mono bg-gray-100 dark:bg-slate-700 px-1 rounded text-[10px]">Description, Marks, Quantity, Unit, Weight, HSCode</span>.
              </p>
              <button
                onClick={handleDownloadTemplate}
                className="flex items-center gap-2 text-xs font-bold text-primary-600 dark:text-primary-400 hover:text-primary-700 transition"
              >
                <Download className="w-3.5 h-3.5" /> Download Excel Template
              </button>
            </div>

            {/* Generation & History */}
            <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 p-6 rounded-2xl">
              <h3 className="font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2 text-sm">
                <span className="w-8 h-8 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg flex items-center justify-center shrink-0">
                  <History className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </span>
                Generation &amp; History
              </h3>
              <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                Select a cargo type, fill in the route details and goods list, then generate a CMR PDF instantly with live preview. All generated documents are saved locally in your browser history for re-download at any time.
              </p>
            </div>
          </div>

          {/* CTA */}
          <div className="flex flex-col items-center gap-4">
            <button
              onClick={handleContinue}
              className="bg-primary-600 hover:bg-primary-500 text-white px-10 py-3.5 rounded-xl font-black text-base shadow-lg shadow-primary-500/25 transition hover:-translate-y-0.5 flex items-center gap-3"
            >
              Open CMR Tool <ArrowRight className="w-5 h-5" />
            </button>

            <label className="flex items-center gap-3 cursor-pointer group">
              <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${dontShowAgain ? 'bg-primary-600 border-primary-600' : 'bg-white dark:bg-slate-900 border-gray-300 dark:border-slate-600 group-hover:border-primary-500'}`}>
                {dontShowAgain && <CheckSquare className="w-3.5 h-3.5 text-white" />}
              </div>
              <input type="checkbox" className="hidden" checked={dontShowAgain} onChange={e => setDontShowAgain(e.target.checked)} />
              <span className="text-sm text-gray-500 dark:text-gray-400 group-hover:text-gray-800 dark:group-hover:text-gray-200 transition">
                Don&apos;t show this again
              </span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
