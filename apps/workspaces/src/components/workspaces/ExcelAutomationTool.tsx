'use client';

import { useState, useRef } from 'react';
import * as xlsx from 'xlsx';
import { 
  UploadCloud, 
  FileSpreadsheet, 
  ArrowRight, 
  Settings2, 
  Save, 
  Plus, 
  Wand2,
  Table,
  ColumnsIcon,
  Filter,
  ArrowUpDown,
  Calculator,
  PaintBucket,
  Trash2,
  CheckCircle2,
  Download
} from 'lucide-react';

type Step = 'initial' | 'upload' | 'structure' | 'transform' | 'output';

export default function ExcelAutomationTool() {
  const [step, setStep] = useState<Step>('initial');
  const [file, setFile] = useState<File | null>(null);
  const [workbook, setWorkbook] = useState<xlsx.WorkBook | null>(null);
  const [sheets, setSheets] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [columns, setColumns] = useState<string[]>([]);
  const [previewData, setPreviewData] = useState<any[]>([]);
  
  const [activeTransformOption, setActiveTransformOption] = useState<string>('columns');
  const [isAutoSaving, setIsAutoSaving] = useState(true);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (uploadedFile) {
      setFile(uploadedFile);
      processFile(uploadedFile);
    }
  };

  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const wb = xlsx.read(data, { type: 'array' });
      setWorkbook(wb);
      setSheets(wb.SheetNames);
      
      if (wb.SheetNames.length > 0) {
        selectSheet(wb, wb.SheetNames[0]);
      }
      setStep('structure');
    };
    reader.readAsArrayBuffer(file);
  };

  const selectSheet = (wb: xlsx.WorkBook, sheetName: string) => {
    setSelectedSheet(sheetName);
    const ws = wb.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(ws, { header: 1 });
    if (data.length > 0) {
      // Setup columns and preview
      const headerRow = data[0] as string[];
      setColumns(headerRow.map((c, i) => c ? String(c) : `Column ${i+1}`));
      
      // Formatting preview data (up to 5 rows)
      const previewRows = data.slice(1, 6).map((r: any) => {
        const rowObj: any = {};
        headerRow.forEach((col, i) => {
          rowObj[col || `Column ${i+1}`] = r[i];
        });
        return rowObj;
      });
      setPreviewData(previewRows);
    }
  };

  return (
    <div className="animate-fade-in bg-white dark:bg-dark-card rounded-2xl border border-gray-100 dark:border-dark-border shadow-sm overflow-hidden flex flex-col min-h-[600px]">
      
      {/* Header / Stepper Context */}
      {step !== 'initial' && (
        <div className="bg-gray-50 dark:bg-slate-800/50 border-b border-gray-100 dark:border-dark-border px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4 text-sm font-bold text-gray-400 dark:text-gray-500">
            <span className={`flex items-center gap-1.5 ${step === 'upload' ? 'text-primary-600 dark:text-primary-400' : 'text-gray-900 dark:text-white'}`}>
              <span className="w-5 h-5 rounded-full bg-gray-200 dark:bg-slate-700 flex items-center justify-center text-xs">1</span> Input
            </span>
            <ArrowRight className="w-4 h-4" />
            <span className={`flex items-center gap-1.5 ${step === 'structure' ? 'text-primary-600 dark:text-primary-400' : step === 'transform' || step === 'output' ? 'text-gray-900 dark:text-white' : ''}`}>
              <span className="w-5 h-5 rounded-full bg-gray-200 dark:bg-slate-700 flex items-center justify-center text-xs">2</span> Map
            </span>
            <ArrowRight className="w-4 h-4" />
            <span className={`flex items-center gap-1.5 ${step === 'transform' ? 'text-primary-600 dark:text-primary-400' : step === 'output' ? 'text-gray-900 dark:text-white' : ''}`}>
               <span className="w-5 h-5 rounded-full bg-gray-200 dark:bg-slate-700 flex items-center justify-center text-xs">3</span> Transform
            </span>
            <ArrowRight className="w-4 h-4" />
            <span className={`flex items-center gap-1.5 ${step === 'output' ? 'text-primary-600 dark:text-primary-400' : ''}`}>
               <span className="w-5 h-5 rounded-full bg-gray-200 dark:bg-slate-700 flex items-center justify-center text-xs">4</span> Output
            </span>
          </div>
          
          <div className="flex items-center gap-4">
             <label className="flex items-center gap-2 cursor-pointer">
               <div className="relative">
                 <input type="checkbox" className="sr-only" checked={isAutoSaving} onChange={() => setIsAutoSaving(!isAutoSaving)} />
                 <div className={`block w-10 h-6 rounded-full transition-colors ${isAutoSaving ? 'bg-primary-500' : 'bg-gray-300 dark:bg-slate-700'}`}></div>
                 <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${isAutoSaving ? 'transform translate-x-4' : ''}`}></div>
               </div>
               <span className="text-xs font-bold text-gray-500">Autosave</span>
             </label>
             {(step === 'transform' || step === 'output') && (
               <button 
                onClick={() => setShowSaveModal(true)}
                className="flex items-center gap-2 bg-primary-600 hover:bg-primary-500 text-white px-4 py-2 rounded-lg text-sm font-bold transition">
                 <Save className="w-4 h-4" /> Save Workflow
               </button>
             )}
          </div>
        </div>
      )}

      {/* Dynamic Content Area */}
      <div className="flex-1 flex flex-col relative w-full h-full p-6">
        
        {step === 'initial' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <div className="w-24 h-24 bg-primary-50 dark:bg-primary-900/20 rounded-full flex items-center justify-center mb-6 cursor-pointer hover:scale-110 transition-transform shadow-lg border-4 border-white dark:border-dark-bg"
                 onClick={() => setStep('upload')}>
               <Plus className="w-12 h-12 text-primary-600 dark:text-primary-400" />
            </div>
            <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-2">Create New Automation</h2>
            <p className="text-gray-500 dark:text-gray-400 max-w-sm mb-8">Start from scratch or clone an existing template to transform your Excel sheets automatically.</p>
            <div className="flex items-center gap-4">
               <button className="px-6 py-3 bg-gray-900 text-white dark:bg-white dark:text-gray-900 rounded-xl font-bold hover:opacity-90 transition shadow-sm" onClick={() => setStep('upload')}>
                 Start Blank
               </button>
               <button className="px-6 py-3 bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border text-gray-900 dark:text-white rounded-xl font-bold hover:bg-gray-50 dark:hover:bg-slate-800 transition shadow-sm">
                 Browse Templates
               </button>
            </div>
          </div>
        )}

        {step === 'upload' && (
          <div className="flex-1 flex flex-col items-center justify-center">
             <input type="file" accept=".xlsx, .xls, .csv" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
             <div 
                className="w-full max-w-2xl border-2 border-dashed border-gray-300 dark:border-slate-700 rounded-3xl p-12 flex flex-col items-center text-center hover:bg-gray-50 dark:hover:bg-slate-800/50 hover:border-primary-500 dark:hover:border-primary-500 transition-colors cursor-pointer group"
                onClick={() => fileInputRef.current?.click()}>
                <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                   <UploadCloud className="w-8 h-8 text-blue-500" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Drag and drop your Excel file here</h3>
                <p className="text-gray-500 dark:text-gray-400">or click to browse your files. (.xlsx, .csv)</p>
             </div>
          </div>
        )}

        {step === 'structure' && (
           <div className="flex-1 flex flex-col lg:flex-row gap-6">
              {/* Sheets Sidebar */}
              <div className="w-full lg:w-64 bg-gray-50 dark:bg-slate-800/30 rounded-2xl p-4 border border-gray-100 dark:border-dark-border">
                 <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4 uppercase tracking-wider flex items-center gap-2">
                    <Table className="w-4 h-4" /> Detected Sheets
                 </h3>
                 <div className="space-y-2">
                    {sheets.map(sheet => (
                       <button 
                          key={sheet}
                          onClick={() => {
                             if(workbook) selectSheet(workbook, sheet);
                          }}
                          className={`w-full flex items-center gap-2 p-3 rounded-xl text-sm font-bold transition-colors ${
                             selectedSheet === sheet 
                             ? 'bg-white dark:bg-dark-card text-primary-600 dark:text-primary-400 shadow-sm border border-gray-200 dark:border-slate-700' 
                             : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-800'
                          }`}>
                          <FileSpreadsheet className="w-4 h-4" /> {sheet}
                       </button>
                    ))}
                 </div>
              </div>

              {/* Data Preview */}
              <div className="flex-1 flex flex-col">
                 <h3 className="text-lg font-black text-gray-900 dark:text-white mb-4">Data Structure Map</h3>
                 
                 <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-2xl overflow-hidden shadow-sm flex-1 flex flex-col">
                    <div className="overflow-x-auto flex-1">
                       <table className="w-full text-left text-sm whitespace-nowrap">
                          <thead className="bg-gray-50 dark:bg-slate-800/80 border-b border-gray-200 dark:border-dark-border">
                             <tr>
                                {columns.map((col, idx) => (
                                   <th key={idx} className="p-3 font-bold text-gray-700 dark:text-gray-300 border-r border-gray-200 dark:border-dark-border last:border-0">{col}</th>
                                ))}
                             </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 dark:divide-dark-border">
                             {previewData.map((row, rIdx) => (
                                <tr key={rIdx} className="hover:bg-gray-50 dark:hover:bg-slate-800/50">
                                   {columns.map((col, cIdx) => (
                                      <td key={cIdx} className="p-3 text-gray-500 dark:text-gray-400 border-r border-gray-100 dark:border-dark-border last:border-0 truncate max-w-[200px]">
                                         {row[col]}
                                      </td>
                                   ))}
                                </tr>
                             ))}
                          </tbody>
                       </table>
                    </div>
                    <div className="bg-gray-50 dark:bg-slate-800/80 p-3 border-t border-gray-200 dark:border-dark-border flex justify-between items-center text-xs font-semibold text-gray-500">
                       <span>{columns.length} columns detected</span>
                       <span>Previewing up to 5 rows</span>
                    </div>
                 </div>

                 <div className="mt-6 flex justify-end">
                    <button onClick={() => setStep('transform')} className="bg-primary-600 text-white hover:bg-primary-500 px-6 py-3 rounded-xl font-bold shadow-md transition flex items-center gap-2">
                       Define Transformations <ArrowRight className="w-4 h-4" />
                    </button>
                 </div>
              </div>
           </div>
        )}

        {step === 'transform' && (
           <div className="flex-1 flex flex-col lg:flex-row gap-6">
              
              {/* Visual Builder Sidebar Tools */}
              <div className="w-full lg:w-72 flex flex-col gap-4">
                 <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-100 dark:border-indigo-500/20 rounded-2xl p-4">
                    <h3 className="font-black text-indigo-900 dark:text-indigo-300 flex items-center gap-2 mb-2">
                       <Wand2 className="w-4 h-4" /> AI Assistant
                    </h3>
                    <textarea 
                       className="w-full text-sm rounded-xl border-0 bg-white/50 dark:bg-black/20 focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-white placeholder:text-gray-500 p-3 mb-2 resize-none"
                       rows={3}
                       placeholder='e.g. "Keep only the VIN and Load Date columns. Highlight rows where load > 20 tons."'
                       value={aiPrompt}
                       onChange={e => setAiPrompt(e.target.value)}
                    ></textarea>
                    <button className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold py-2 rounded-lg transition shadow-sm">
                       Generate Magic Workflow
                    </button>
                 </div>

                 <div className="bg-gray-50 dark:bg-slate-800/30 rounded-2xl border border-gray-100 dark:border-dark-border overflow-hidden">
                    <div className="p-3 border-b border-gray-100 dark:border-dark-border">
                       <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">Data Operations</h3>
                    </div>
                    <div className="p-2 space-y-1">
                       <button onClick={() => setActiveTransformOption('columns')} className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-sm font-semibold transition ${activeTransformOption === 'columns' ? 'bg-white dark:bg-dark-card text-gray-900 dark:text-white shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-800'}`}>
                          <ColumnsIcon className="w-4 h-4"/> Manage Columns
                       </button>
                       <button onClick={() => setActiveTransformOption('filter')} className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-sm font-semibold transition ${activeTransformOption === 'filter' ? 'bg-white dark:bg-dark-card text-gray-900 dark:text-white shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-800'}`}>
                          <Filter className="w-4 h-4"/> Filter & Sort
                       </button>
                       <button onClick={() => setActiveTransformOption('formula')} className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-sm font-semibold transition ${activeTransformOption === 'formula' ? 'bg-white dark:bg-dark-card text-gray-900 dark:text-white shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-800'}`}>
                          <Calculator className="w-4 h-4"/> Formulas (SUM, etc)
                       </button>
                       <button onClick={() => setActiveTransformOption('format')} className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-sm font-semibold transition ${activeTransformOption === 'format' ? 'bg-white dark:bg-dark-card text-gray-900 dark:text-white shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-800'}`}>
                          <PaintBucket className="w-4 h-4"/> Conditional Format
                       </button>
                    </div>
                 </div>
              </div>

              {/* Transformation Canvas */}
              <div className="flex-1 bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-2xl p-6 shadow-sm flex flex-col">
                 <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100 dark:border-dark-border">
                    <h3 className="text-xl font-black text-gray-900 dark:text-white capitalize flex items-center gap-2">
                       {activeTransformOption === 'columns' && <><ColumnsIcon className="w-5 h-5 text-primary-500" /> Manage Columns</>}
                       {activeTransformOption === 'filter' && <><Filter className="w-5 h-5 text-blue-500" /> Filter & Sort Rows</>}
                       {activeTransformOption === 'formula' && <><Calculator className="w-5 h-5 text-purple-500" /> Apply Formulas</>}
                       {activeTransformOption === 'format' && <><PaintBucket className="w-5 h-5 text-yellow-500" /> Conditional Formatting</>}
                    </h3>
                    {activeTransformOption === 'columns' && (
                       <button className="text-sm font-bold text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1">
                          <Plus className="w-4 h-4"/> Add Custom Column
                       </button>
                    )}
                 </div>

                 {activeTransformOption === 'columns' && (
                    <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                       {columns.map((col, idx) => (
                          <div key={idx} className="flex items-center gap-4 bg-gray-50 dark:bg-slate-800/50 p-3 rounded-xl border border-gray-200 dark:border-slate-700 hover:border-primary-300 transition-colors group">
                             <ArrowUpDown className="w-4 h-4 text-gray-400 cursor-move" />
                             <input type="text" defaultValue={col} className="flex-1 bg-transparent border-0 font-bold text-gray-900 dark:text-white focus:ring-0 p-0" />
                             <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button className="p-1.5 text-gray-400 hover:text-red-500 transition"><Trash2 className="w-4 h-4"/></button>
                             </div>
                          </div>
                       ))}
                    </div>
                 )}

                 {/* Placeholders for other transform views */}
                 {(activeTransformOption === 'filter' || activeTransformOption === 'formula' || activeTransformOption === 'format') && (
                    <div className="flex-1 flex flex-col items-center justify-center text-center text-gray-500">
                       <Settings2 className="w-12 h-12 text-gray-300 dark:text-slate-700 mb-4" />
                       <p className="font-semibold text-gray-900 dark:text-white">{activeTransformOption} builder area</p>
                       <p className="text-sm mt-2 max-w-sm">Use the UI elements to visually configure data transformation rules for the output logic.</p>
                    </div>
                 )}

                 <div className="mt-6 flex justify-end">
                    <button onClick={() => setStep('output')} className="bg-gray-900 text-white dark:bg-white dark:text-gray-900 px-6 py-3 rounded-xl font-bold hover:opacity-90 shadow-sm transition flex items-center gap-2">
                       Next: Output Settings <ArrowRight className="w-4 h-4" />
                    </button>
                 </div>
              </div>

           </div>
        )}

        {step === 'output' && (
           <div className="flex-1 flex flex-col items-center justify-center max-w-2xl mx-auto w-full">
              <div className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-3xl p-8 shadow-lg w-full">
                 <div className="w-16 h-16 bg-green-50 dark:bg-green-900/20 rounded-full flex items-center justify-center mb-6 mx-auto">
                    <CheckCircle2 className="w-8 h-8 text-green-500" />
                 </div>
                 <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-2 text-center">Workflow Ready</h2>
                 <p className="text-gray-500 mb-8 text-center">Configure how your transformed file should be saved and generated.</p>
                 
                 <div className="space-y-6">
                    <div>
                       <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Output File Name</label>
                       <input type="text" defaultValue={`Cleaned_${file?.name || 'Output.xlsx'}`} className="block w-full rounded-xl border-0 py-3 text-gray-900 dark:text-white dark:bg-slate-900 ring-1 ring-inset ring-gray-200 dark:ring-dark-border focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm shadow-sm" />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Worksheet Structure</label>
                        <select className="block w-full rounded-xl border-0 py-3 text-gray-900 dark:text-white dark:bg-slate-900 ring-1 ring-inset ring-gray-200 dark:ring-dark-border focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm shadow-sm font-medium">
                           <option>Single Sheet (All Data)</option>
                           <option>Split by Category/Column</option>
                           <option>Multiple Files (Batch)</option>
                        </select>
                    </div>
                 </div>

                 <div className="mt-8 pt-8 border-t border-gray-100 dark:border-dark-border grid grid-cols-2 gap-4">
                    <button className="flex justify-center items-center gap-2 px-6 py-4 bg-gray-100 dark:bg-slate-800 text-gray-900 dark:text-white font-bold rounded-xl hover:bg-gray-200 dark:hover:bg-slate-700 transition">
                       <Save className="w-5 h-5"/> Save as Template
                    </button>
                    <button className="flex justify-center items-center gap-2 px-6 py-4 bg-primary-600 text-white font-bold rounded-xl hover:bg-primary-500 transition shadow-md">
                       <Download className="w-5 h-5"/> Generate Excel
                    </button>
                 </div>
              </div>
           </div>
        )}

      </div>

      {/* Save Modal */}
      {showSaveModal && (
         <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-dark-card rounded-3xl p-6 w-full max-w-md shadow-2xl scale-100 transform transition-transform">
               <h3 className="text-xl font-black text-gray-900 dark:text-white mb-2">Save Workflow</h3>
               <p className="text-sm text-gray-500 mb-6">You can save this transformation structure as a template for future use.</p>
               
               <input type="text" placeholder="Workflow Name (e.g. Daily Dispatch Clean)" className="block w-full rounded-xl border-0 py-3 mb-4 text-gray-900 dark:text-white dark:bg-slate-900 ring-1 ring-inset ring-gray-200 dark:ring-dark-border focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm shadow-sm" />
               <select className="block w-full rounded-xl border-0 py-3 mb-6 text-gray-900 dark:text-white dark:bg-slate-900 ring-1 ring-inset ring-gray-200 dark:ring-dark-border focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm shadow-sm">
                  <option>VIN Management</option>
                  <option>Reports</option>
                  <option>Fleet</option>
                  <option>Create New Folder...</option>
               </select>

               <div className="flex gap-3 justify-end">
                  <button onClick={() => setShowSaveModal(false)} className="px-4 py-2 text-sm font-bold text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">Cancel</button>
                  <button onClick={() => setShowSaveModal(false)} className="px-5 py-2.5 text-sm font-bold bg-primary-600 text-white rounded-xl shadow-sm hover:bg-primary-500">Save & Close</button>
               </div>
               <p className="text-xs text-center text-gray-400 mt-4">Templates can also be managed from the Templates tab later.</p>
            </div>
         </div>
      )}

    </div>
  );
}
