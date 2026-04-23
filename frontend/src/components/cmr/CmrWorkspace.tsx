'use client';

import { useState, useEffect, useRef } from 'react';
import {
  FileText, Copy, Settings, History as HistoryIcon,
  Sun, Moon, Users, Upload, Trash2, Printer, MapPin,
  Package, Layers, AlertTriangle, Snowflake, ChevronsUp,
  ChevronDown, PlusCircle, Check, X, Pencil, Save, Download,
  Search, ShieldAlert, Archive, FileArchive
} from 'lucide-react';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { get, set } from 'idb-keyval';
import { useTheme } from 'next-themes';
import {
  createCmrPdf, createCustomTemplatePdf,
  GoodsItem, CmrData, Settings as AppSettings, User,
  CargoType, TemplateField, CARGO_TYPE_LABELS, TEMPLATE_FIELD_KEYS
} from '@/lib/cmrGenerator';

/* ── Types ── */
interface CustomCmrTemplate {
  id: string;
  name: string;
  fields: TemplateField[];
}

/* ── Cargo type config ── */
const CARGO_TYPES: { type: CargoType; label: string; desc: string; icon: React.ReactNode; color: string }[] = [
  { type: 'general',   label: 'General Cargo',               desc: 'Pallets, boxes, standard goods',   icon: <Package className="w-4 h-4"/>,       color: 'text-blue-600' },
  { type: 'adr',       label: 'Dangerous Goods (ADR)',       desc: 'Flammable, toxic, corrosive',      icon: <AlertTriangle className="w-4 h-4"/>, color: 'text-red-600' },
  { type: 'frigo',     label: 'Perishable (Frigo/Termo)',    desc: 'Food, pharma, temperature controlled', icon: <Snowflake className="w-4 h-4"/>,     color: 'text-cyan-600' },
  { type: 'high_value', label: 'High Value Cargo',            desc: 'Electronics, luxury, declared value', icon: <Check className="w-4 h-4"/>,       color: 'text-amber-600' },
  { type: 'oversized', label: 'Oversized Cargo',             desc: 'Machinery, wide/high, special permits', icon: <ChevronsUp className="w-4 h-4"/>,    color: 'text-purple-600' },
];

const DEFAULT_TEMPLATES: Record<string, any> = {
  'Sample EU':   { name: 'Sample EU',   country: 'EU', sender: 'Your Company Name\nYour Address\nCity, Country', consignee: 'Receiver Company\nReceiver Address\nCity, Country', delivery: 'Receiver warehouse', instructions: '' },
  'Sample EX':   { name: 'Sample EX',   country: 'EX', sender: '', consignee: '', delivery: '', instructions: '' },
};

/* ── Main Component ── */
export default function CmrWorkspace() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  
  const [activeTab, setActiveTab] = useState<'production'|'templates'|'settings'|'history'>('production');
  const [activeStep, setActiveStep] = useState(0); 
  const [cargoType, setCargoType] = useState<CargoType>('general');
  const [cargoDropOpen, setCargoDropOpen] = useState(false);
  const [printLoadingList, setPrintLoadingList] = useState(true);
  const [useCustomTemplate, setUseCustomTemplate] = useState(false);
  const [batchJobs, setBatchJobs] = useState<{ data: CmrData, goods: GoodsItem[] }[]>([]);
  const [editingTemplateId, setEditingTemplateId] = useState<string|null>(null);

  /* app state */
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User|null>(null);
  const [templates, setTemplates] = useState<any>(DEFAULT_TEMPLATES);
  const [settings, setSettings] = useState<AppSettings>({ logo: null, sign: null });
  const [history, setHistory] = useState<any[]>([]);
  const [customCmrTemplates, setCustomCmrTemplates] = useState<CustomCmrTemplate[]>([]);

  /* production form */
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    startCmr: 1,
    sender: '', consignee: '', delivery: '', loading: '',
    carrier: '', instr: '', plate: '',
    // ADR
    unNumber: '', officialName: '', hazardLabel: '', packingGroup: '', tunnelCode: '', netWeightADR: '', grossWeightADR: '',
    // Frigo
    temperature: '', coolingInstructions: '', loadingTime: '', unloadingTime: '',
    // High Value
    declaredValue: '',
    // Oversized
    l: '', w: '', h: '', permitNumber: '', specialNotes: '',
  });
  const [goods, setGoods] = useState<GoodsItem[]>([]);
  const [generatedPdf, setGeneratedPdf] = useState<string|null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [pdfReadyToSave, setPdfReadyToSave] = useState<{ id: string, blob: Blob, data: any } | null>(null);
  const [isSavedToHistory, setIsSavedToHistory] = useState(false);

  /* history filters & selection */
  const [historySearch, setHistorySearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isZipping, setIsZipping] = useState(false);

  /* delete confirmation */
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleteCode, setDeleteCode] = useState('');
  const [deleteInput, setDeleteInput] = useState('');

  /* custom template editor state */
  const [editFields, setEditFields] = useState<TemplateField[]>([]);
  const [templateBlobUrl, setTemplateBlobUrl] = useState<string|null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState({ x: 0, y: 0 });
  const [currentRect, setCurrentRect] = useState<{x:number,y:number,w:number,h:number}|null>(null);
  const [pendingRect, setPendingRect] = useState<{x:number,y:number,w:number,h:number}|null>(null);
  const [pendingFieldKey, setPendingFieldKey] = useState('sender');

  /* ── Load/save state ── */
  useEffect(() => {
    const load = async () => {
      const s = await get('vectra_cmr_state_v2');
      if (s) {
        setUsers(s.users || []);
        if (s.lastUserId) {
          const u = s.users?.find((x:any) => x.id === s.lastUserId);
          if (u) { setCurrentUser(u); setFormData(p => ({...p, startCmr: u.nextCmr})); }
        }
        setTemplates(s.templates || DEFAULT_TEMPLATES);
        setSettings(s.settings || { logo: null, sign: null });
        setHistory(s.history || []);
        setCustomCmrTemplates(s.customCmrTemplates || []);
      }
    };
    load();
  }, []);

  const persist = () => {
    set('vectra_cmr_state_v2', { users, lastUserId: currentUser?.id, templates, settings, history, customCmrTemplates });
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (currentUser) persist(); }, [users, currentUser, templates, settings, history, customCmrTemplates]);

  /* ── Canvas draw ── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    editFields.forEach(f => {
      const x = (f.x/100)*canvas.width, y = (f.y/100)*canvas.height;
      const w = ((f as any).w/100)*canvas.width, h = ((f as any).h/100)*canvas.height;
      ctx.strokeStyle = '#10b981'; ctx.lineWidth = 1.5;
      ctx.strokeRect(x,y,w,h);
      ctx.fillStyle = 'rgba(16,185,129,0.08)'; ctx.fillRect(x,y,w,h);
      ctx.fillStyle = '#059669'; ctx.font = 'bold 10px sans-serif';
      ctx.fillText(f.name, x+3, y+13);
    });
    if (currentRect) {
      ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 1.5;
      ctx.setLineDash([4,4]); ctx.strokeRect(currentRect.x,currentRect.y,currentRect.w,currentRect.h);
      ctx.setLineDash([]);
    }
  }, [editFields, currentRect]);

  const canvasPos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  /* ── Goods helpers ── */
  const addGoodsItem = () => setGoods(g => [...g, {
    id: Date.now().toString(), marks: '', description: '', quantity: 1, unit: 'box', weight: 0, hsCode: ''
  }]);



  const updateGoods = (id: string, key: keyof GoodsItem, val: any) =>
    setGoods(g => g.map(x => x.id === id ? {...x, [key]: val} : x));

  const removeGoods = (id: string) => setGoods(g => g.filter(x => x.id !== id));

  /* ── Excel import ── */
  const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = evt => {
      const wb = XLSX.read(evt.target?.result, { type: 'binary' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<any>(ws);
      
      const jobs: { data: CmrData, goods: GoodsItem[] }[] = [];
      let lastPlate: string | null = null;
      let currentJob: any = null;

      rows.forEach(r => {
        const plate = String(r['Plate'] || r['Kamionska Tablica'] || r['Tablica'] || 'TEMP').trim();
        if (plate !== lastPlate) {
          lastPlate = plate;
          const nextStartCmr = currentUser ? currentUser.nextCmr + jobs.length : (formData.startCmr + jobs.length);
          const cmrId = r['CmrID'] || (currentUser ? `${currentUser.initials}${String(nextStartCmr).padStart(7,'0')}` : `CMR-${Date.now()}`);
          
          currentJob = {
            data: {
              sender: r['Sender'] || r['Pošiljatelj'] || '',
              consignee: r['Consignee'] || r['Prejemnik'] || '',
              delivery: r['Delivery'] || r['Razklad'] || '',
              loading: r['Loading'] || r['Naklad'] || '',
              carrier: r['Carrier'] || r['Prevoznik'] || '',
              instr: r['Instructions'] || r['Navodila'] || '',
              date: r['Date'] || r['Datum'] || new Date().toISOString().split('T')[0],
              plate: plate,
              cmrId: cmrId,
              cargoType: (r['CargoType'] || r['Tip Tovora'] || 'general').toLowerCase(),
              unNumber: r['UN_Number'] || r['UN_Stevilka'] || '',
              officialName: r['OfficialName'] || r['Tehnicno_Ime'] || '',
              hazardLabel: r['HazardLabel'] || r['Nalepka'] || '',
              packingGroup: r['PackingGroup'] || r['Skupina_Embalaze'] || '',
              tunnelCode: r['TunnelCode'] || r['Tunelska_Koda'] || '',
              temperature: r['Temperature'] || r['Temperatura'] || '',
              coolingInstructions: r['CoolingInstructions'] || r['Navodila_Hlajenja'] || '',
              declaredValue: r['DeclaredValue'] || r['Vrednost'] || '',
              permitNumber: r['PermitNumber'] || r['Dovoljenje'] || '',
              specialNotes: r['SpecialNotes'] || r['Opis_Izredni'] || '',
            },
            goods: []
          };
          jobs.push(currentJob);
        }
        currentJob.goods.push({
          id: Math.random().toString(36).substr(2, 9),
          marks: r['Marks'] || r['Oznaka'] || '',
          description: r['Description'] || r['Opis'] || '',
          quantity: parseFloat(r['Qty'] || r['Kolicina'] || r['Quantity']) || 0,
          unit: r['Unit'] || r['Enota'] || 'pcs',
          weight: parseFloat(r['Weight'] || r['Teza'] || r['Weight(kg)']) || 0,
          hsCode: r['HSCode'] || r['HS'] || '',
        });
      });

      if (jobs.length === 1) {
        setFormData(prev => ({...prev, ...jobs[0].data}));
        setGoods(jobs[0].goods);
        setCargoType(jobs[0].data.cargoType || 'general');
        setActiveStep(0);
        alert('Podatki CMR so bili uspešno uvoženi.');
      } else if (jobs.length > 1) {
        setBatchJobs(jobs);
        alert(`Zaznanih je bilo ${jobs.length} različnih CMR-jev (glede na tablice). Preverite "Batch Processing" gumb.`);
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  /* ── Generate PDF ── */
  const handleGenerate = async () => {
    if (!currentUser) return alert('Niste izbrali uporabnika v nastavitvah.');
    if (goods.length === 0) return alert('Dodajte vsaj eno postavko blaga.');
    setIsGenerating(true);
    try {
      const cmrId = `${currentUser.initials}${String(formData.startCmr).padStart(7,'0')}`;
      const data: CmrData = {
        ...formData,
        date: new Date(formData.date).toLocaleDateString('en-GB'),
        cmrId,
        cargoType,
        dimensions: formData.l ? { l: formData.l, w: formData.w, h: formData.h } : undefined,
      };

      let blob: Blob;
      if (useCustomTemplate) {
        const activeTemplate = customCmrTemplates[0];
        if (!activeTemplate) return alert('Nimate nastavljene predloge po meri.');
        blob = await createCustomTemplatePdf(activeTemplate.fields, data, goods);
      } else {
        blob = await createCmrPdf(goods, cmrId, data, settings, currentUser, printLoadingList);
      }

      await set(`cmr_pdf_temp`, blob); // Store temp for preview
      setPdfReadyToSave({ id: cmrId, blob, data: { ...data, goods } });
      setIsSavedToHistory(false);
      setGeneratedPdf(URL.createObjectURL(blob));
    } catch (err) {
      console.error(err); alert('Napaka pri generiranju CMR-ja.');
    } finally { setIsGenerating(false); }
  };

  const handleSaveToHistory = async () => {
    if (!pdfReadyToSave || !currentUser) return;
    try {
      const { id, blob } = pdfReadyToSave;
      await set(`cmr_pdf_${id}`, blob);
      
      const entry = { 
        id, 
        date: new Date().toISOString(), 
        user: currentUser.name, 
        count: pdfReadyToSave.data.goods.length, 
        dest: pdfReadyToSave.data.consignee.split('\n')[0], 
        cargoType: pdfReadyToSave.data.cargoType 
      };
      
      setHistory(h => [entry, ...h]);
      
      const updated = { ...currentUser, nextCmr: currentUser.nextCmr + 1 };
      setUsers(u => u.map(x => x.id === currentUser.id ? updated : x));
      setCurrentUser(updated);
      setFormData(p => ({...p, startCmr: updated.nextCmr}));
      
      setIsSavedToHistory(true);
      setPdfReadyToSave(null);
      alert(`CMR ${id} je bil shranjen v zgodovino.`);
    } catch (e) {
      console.error(e);
      alert('Napaka pri shranjevanju.');
    }
  };

  const handleBatchGenerate = async () => {
    if (!currentUser) return alert('Select user first.');
    if (batchJobs.length === 0) return;
    setIsGenerating(true);
    let count = 0;
    try {
      for (const job of batchJobs) {
        const blob = await createCmrPdf(job.goods, job.data.cmrId, {
          ...job.data, 
          date: new Date(job.data.date).toLocaleDateString('en-GB')
        }, settings, currentUser, printLoadingList);
        await set(`cmr_pdf_${job.data.cmrId}`, blob);
        
        const entry = { 
          id: job.data.cmrId, 
          date: new Date().toISOString(), 
          user: currentUser.name, 
          count: job.goods.length, 
          dest: job.data.consignee.split('\n')[0], 
          cargoType: job.data.cargoType 
        };
        setHistory(h => [entry, ...h]);
        count++;
      }
      const finalUser = { ...currentUser, nextCmr: currentUser.nextCmr + batchJobs.length };
      setUsers(u => u.map(x => x.id === currentUser.id ? finalUser : x));
      setCurrentUser(finalUser);
      setFormData(p=>({...p, startCmr: finalUser.nextCmr}));
      setBatchJobs([]);
      alert(`Uspešno ustvarjenih in shranjenih ${count} CMR dokumentov v zgodovino.`);
    } catch (e) { console.error(e); alert('Napaka pri serijskem generiranju.'); }
    finally { setIsGenerating(false); }
  };

  /* ── History Actions ── */
  const openDeleteModal = (id: string) => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setDeleteCode(code);
    setDeleteTargetId(id);
    setDeleteInput('');
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (deleteInput !== deleteCode) return alert('Koda ni pravilna.');
    if (!deleteTargetId) return;
    
    setHistory(h => h.filter(x => x.id !== deleteTargetId));
    // optionally remove from idb but usually history is small enough to keep cleanup manual
    setShowDeleteModal(false);
    setDeleteTargetId(null);
  };

  const downloadZip = async () => {
    if (selectedIds.length === 0) return;
    setIsZipping(true);
    try {
      const zip = new JSZip();
      for (const id of selectedIds) {
        const blob = await get(`cmr_pdf_${id}`);
        if (blob) {
          zip.file(`CMR_${id}.pdf`, blob);
        }
      }
      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `CMR_Izvoz_${new Date().toISOString().split('T')[0]}.zip`;
      a.click();
    } catch (e) {
      console.error(e);
      alert('Napaka pri ustvarjanju ZIP-a.');
    } finally {
      setIsZipping(false);
    }
  };

  const filteredHistory = history.filter(h => {
    if (!historySearch) return true;
    const s = historySearch.toLowerCase();
    const dateStr = new Date(h.date).toLocaleDateString();
    return (
      h.id.toLowerCase().includes(s) ||
      h.user.toLowerCase().includes(s) ||
      h.dest.toLowerCase().includes(s) ||
      dateStr.includes(s) ||
      (h.cargoType && h.cargoType.toLowerCase().includes(s))
    );
  });

  const applyTemplate = (id: string) => {
    const t = templates[id]; if (!t) return;
    setFormData(p => ({...p, sender: t.sender||'', consignee: t.consignee||'', delivery: t.delivery||'', instr: t.instructions||''}));
  };

  const selectedCargo = CARGO_TYPES.find(c => c.type === cargoType)!;

  /* ── UI Components ── */
  const Toggle = ({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) => (
    <label className="flex items-center justify-between py-1.5 cursor-pointer group">
      <span className="text-[11px] font-medium text-gray-600 dark:text-gray-400 group-hover:text-primary-500 transition-colors uppercase tracking-wider">{label}</span>
      <div onClick={() => onChange(!value)} className={`relative w-8 h-4 rounded-full transition-all duration-300 ${value ? 'bg-primary-500 shadow-inner' : 'bg-gray-200 dark:bg-slate-700'}`}>
        <div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow-md transition-transform duration-300 ${value ? 'translate-x-4' : 'translate-x-0'}`}/>
      </div>
    </label>
  );

  function Accordion({ title, index, icon, children }: { title: string, index: number, icon: any, children: any }) {
    const isOpen = activeStep === index;
    return (
      <div className={`mb-3 transition-all duration-300 ${isOpen ? 'ring-2 ring-primary-500/20' : ''} rounded-2xl overflow-hidden bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800`}>
        <button onClick={() => setActiveStep(isOpen ? -1 : index)} className={`w-full px-4 py-3 flex items-center justify-between transition-colors ${isOpen ? 'bg-primary-50/50 dark:bg-primary-900/10' : 'hover:bg-gray-50 dark:hover:bg-slate-800/50'}`}>
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${isOpen ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-slate-800 text-gray-500'}`}>{icon}</div>
            <span className={`text-xs font-bold uppercase tracking-tight ${isOpen ? 'text-primary-700 dark:text-primary-400' : 'text-gray-600 dark:text-gray-400'}`}>{title}</span>
          </div>
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}/>
        </button>
        <div className={`transition-all duration-500 ease-in-out ${isOpen ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'} overflow-hidden`}>
          <div className="p-4 border-t border-gray-50 dark:border-slate-800/50">{children}</div>
        </div>
      </div>
    );
  }


  /* ── Image upload helper ── */
  const handleImageUpload = (key: 'logo'|'sign', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const r = new FileReader();
    r.onload = ev => setSettings(s => ({...s, [key]: ev.target?.result as string}));
    r.readAsDataURL(file);
  };

  /* ── Custom template PDF upload ── */
  const handleTemplatePdfUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const url = URL.createObjectURL(file);
    setTemplateBlobUrl(url);
    const newTpl: CustomCmrTemplate = { id: Date.now().toString(), name: file.name.replace('.pdf',''), fields: [] };
    setCustomCmrTemplates(prev => [...prev, newTpl]);
    setEditingTemplateId(newTpl.id);
    setEditFields([]);
  };

  const saveTemplateFields = () => {
    if (!editingTemplateId) return;
    setCustomCmrTemplates(prev => prev.map(t => t.id === editingTemplateId ? {...t, fields: editFields} : t));
    setEditingTemplateId(null);
  };

  /* ════════════════════════════════════════ RENDER ════════════════════════════════════════ */
  return (
    <div className={`h-[calc(100vh-56px)] flex flex-col ${isDark ? 'dark bg-slate-950 text-slate-50' : 'bg-slate-50 text-slate-900'}`}>

      {/* HEADER */}
      <header className="h-14 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between px-4 shrink-0 gap-4">
        <div className="flex items-center gap-3 shrink-0">

          {/* Cargo type dropdown */}
          <div className="relative">
            <button
              onClick={() => setCargoDropOpen(v => !v)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 transition text-sm font-bold min-w-[200px] justify-between"
            >
              <span className={`flex items-center gap-2 ${selectedCargo.color}`}>
                {selectedCargo.icon}
                <span className="text-gray-800 dark:text-gray-100">{selectedCargo.label}</span>
              </span>
              <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${cargoDropOpen ? 'rotate-180' : ''}`}/>
            </button>
            {cargoDropOpen && (
              <div className="absolute top-full left-0 mt-1 z-50 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-xl w-72 overflow-hidden animate-fade-in">
                {CARGO_TYPES.map(c => (
                  <button
                    key={c.type}
                    onClick={() => { setCargoType(c.type); setCargoDropOpen(false); }}
                    className={`w-full flex items-start gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-slate-700 transition text-left ${cargoType === c.type ? 'bg-primary-50 dark:bg-primary-900/20' : ''}`}
                  >
                    <span className={`mt-0.5 ${c.color}`}>{c.icon}</span>
                    <div>
                      <div className="text-xs font-bold text-gray-800 dark:text-gray-100">{c.label}</div>
                      <div className="text-[10px] text-gray-500 dark:text-gray-400">{c.desc}</div>
                    </div>
                    {cargoType === c.type && <Check className="w-3.5 h-3.5 text-primary-500 ml-auto mt-0.5 shrink-0"/>}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="h-5 w-px bg-gray-200 dark:bg-slate-700"/>

          {/* Nav tabs */}
          <nav className="flex items-center gap-0.5">
            {([['production','Production',<FileText className="w-3.5 h-3.5"/>],['templates','Templates',<Copy className="w-3.5 h-3.5"/>],['settings','Settings',<Settings className="w-3.5 h-3.5"/>],['history','History',<HistoryIcon className="w-3.5 h-3.5"/>]] as const).map(([tab, label, icon]) => (
              <button key={tab} onClick={() => setActiveTab(tab as any)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${activeTab === tab ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800'}`}>
                {icon} {label}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {currentUser ? (
            <div className="text-xs font-bold px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              {currentUser.name}
            </div>
          ) : (
            <div className="text-xs font-bold px-3 py-1.5 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 animate-pulse border border-orange-200 dark:border-orange-800">Ni uporabnika</div>
          )}
        </div>
      </header>

      {/* MAIN */}
      <main className="flex-1 flex overflow-hidden bg-white dark:bg-slate-950" onClick={() => cargoDropOpen && setCargoDropOpen(false)}>

        {/* ═══ TAB: PRODUCTION ═══ */}
        {activeTab === 'production' && (
          <div className="flex w-full h-full">

            {/* Sidebar */}
            <div className="w-[420px] bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-800 flex flex-col shadow-lg z-10 shrink-0">
              <div className="p-4 overflow-y-auto flex-1">

                {/* Excel Import Summary (if batch) */}
                {batchJobs.length > 0 && (
                  <div className="mb-4 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 p-3 rounded-xl">
                    <p className="text-xs font-bold text-primary-700 mb-1">Serija pripravljena: {batchJobs.length} CMR-jev</p>
                    <button onClick={handleBatchGenerate} className="w-full bg-primary-600 text-white text-[10px] font-bold py-1.5 rounded-lg hover:bg-primary-500 transition">
                      Ustvari vse zdaj (Generate All)
                    </button>
                    <button onClick={() => setBatchJobs([])} className="w-full mt-1 text-[9px] text-gray-400 hover:text-red-500 underline transition">
                      Prekliči serijo
                    </button>
                  </div>
                )}

                {/* Step 1: Osnovni podatki */}
                <Accordion title="1. Osnovni podatki" index={0} icon={<FileText className="w-4 h-4"/>}>
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div>
                      <label className="label-xs">Datum</label>
                      <input type="date" value={formData.date} onChange={e => setFormData(p=>({...p, date: e.target.value}))} className="input-field"/>
                    </div>
                    <div>
                      <label className="label-xs">CMR Številka</label>
                      <input type="number" value={formData.startCmr} onChange={e => setFormData(p=>({...p, startCmr: parseInt(e.target.value)||1}))}
                        className="w-full border border-gray-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-sm font-mono font-bold text-primary-600 bg-white dark:bg-slate-800 outline-none focus:ring-2 focus:ring-primary-500"/>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div><label className="label-xs">Pošiljatelj (Sender)</label><textarea rows={3} value={formData.sender} onChange={e=>setFormData(p=>({...p,sender:e.target.value}))} className="input-field shadow-inner"/></div>
                    <div><label className="label-xs">Prejemnik (Consignee)</label><textarea rows={3} value={formData.consignee} onChange={e=>setFormData(p=>({...p,consignee:e.target.value}))} className="input-field shadow-inner"/></div>
                    <button onClick={() => setActiveStep(1)} className="w-full bg-primary-600 text-white py-2 rounded-lg text-xs font-bold hover:bg-primary-500 transition">Naslednji korak (Next)</button>
                  </div>
                </Accordion>

                {/* Step 2: Transport & Tablica */}
                <Accordion title="2. Transportni podatki" index={1} icon={<MapPin className="w-4 h-4"/>}>
                  <div className="space-y-3">
                    <div><label className="label-xs">Razklad (Place of Delivery)</label><textarea rows={2} value={formData.delivery} onChange={e=>setFormData(p=>({...p,delivery:e.target.value}))} className="input-field"/></div>
                    <div><label className="label-xs">Naklad (Place of Loading)</label><input value={formData.loading} onChange={e=>setFormData(p=>({...p,loading:e.target.value}))} className="input-field"/></div>
                    <div><label className="label-xs">Tablica vozila (Plate)</label><input value={formData.plate} onChange={e=>setFormData(p=>({...p,plate:e.target.value}))} placeholder="npr. LJ-123-ABC" className="input-field font-bold uppercase"/></div>
                    <div><label className="label-xs">Prevoznik (Carrier)</label><textarea rows={2} value={formData.carrier} onChange={e=>setFormData(p=>({...p,carrier:e.target.value}))} className="input-field"/></div>
                    <button onClick={() => setActiveStep(2)} className="w-full bg-primary-600 text-white py-2 rounded-lg text-xs font-bold hover:bg-primary-500 transition">Naslednji korak (Next)</button>
                  </div>
                </Accordion>

                {/* Step 3: Tip tovora (ADR/Frigo) */}
                <Accordion title="3. Detajli tovora" index={2} icon={<AlertTriangle className="w-4 h-4"/>}>
                   <div className="mb-4">
                    <label className="label-xs">Izberi tip prevoza</label>
                    <select value={cargoType} onChange={e => setCargoType(e.target.value as any)} className="input-field font-bold bg-white dark:bg-slate-800 border-l-4 border-primary-500">
                      {CARGO_TYPES.map(c => <option key={c.type} value={c.type}>{c.label}</option>)}
                    </select>
                  </div>

                  {cargoType === 'adr' && (
                    <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/40 p-3 rounded-xl space-y-2 mb-3">
                      <p className="text-[10px] font-black text-red-600 uppercase">ADR Podatki</p>
                      <div className="grid grid-cols-2 gap-2">
                        <input value={formData.unNumber} onChange={e=>setFormData(p=>({...p,unNumber:e.target.value}))} placeholder="UN Številka" className="input-field border-red-200"/>
                        <input value={formData.hazardLabel} onChange={e=>setFormData(p=>({...p,hazardLabel:e.target.value}))} placeholder="Nalepka" className="input-field border-red-200"/>
                      </div>
                      <input value={formData.officialName} onChange={e=>setFormData(p=>({...p,officialName:e.target.value}))} placeholder="Tehnično ime snovi" className="input-field border-red-200"/>
                    </div>
                  )}

                  {cargoType === 'frigo' && (
                    <div className="bg-cyan-50 dark:bg-cyan-900/10 border border-cyan-200 dark:border-cyan-900/40 p-3 rounded-xl space-y-2 mb-3">
                      <p className="text-[10px] font-black text-cyan-600 uppercase">Temperatura</p>
                      <input value={formData.temperature} onChange={e=>setFormData(p=>({...p,temperature:e.target.value}))} placeholder="-18°C" className="input-field border-cyan-200"/>
                    </div>
                  )}

                  <div>
                    <label className="label-xs">Navodila pošiljatelja</label>
                    <textarea rows={3} value={formData.instr} onChange={e=>setFormData(p=>({...p,instr:e.target.value}))} 
                      placeholder="Posebna navodila, rampe..."
                      className="input-field shadow-inner border-orange-200"/>
                  </div>
                  <button onClick={() => setActiveStep(3)} className="w-full mt-3 bg-primary-600 text-white py-2 rounded-lg text-xs font-bold hover:bg-primary-500 transition">Naslednji korak (Next)</button>
                </Accordion>

                {/* Step 4: GOODS */}
                <Accordion title={`4. Postavke blaga (${goods.length})`} index={3} icon={<Package className="w-4 h-4"/>}>
                  <div className="space-y-3">
                    <div className="bg-primary-50 dark:bg-primary-900/10 border border-primary-200 dark:border-primary-900/40 rounded-xl p-3 flex items-center gap-3">
                      <Upload className="w-4 h-4 text-primary-600 shrink-0"/>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-gray-700 dark:text-gray-200">Uvoz iz Excela (VSE info)</p>
                      </div>
                      <label className="bg-primary-600 hover:bg-primary-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition shrink-0">
                        Uvoz .xlsx <input type="file" className="hidden" accept=".xlsx,.xls" onChange={handleExcelImport}/>
                      </label>
                    </div>

                    <button onClick={addGoodsItem} className="w-full flex items-center justify-center gap-2 py-2 border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-xl text-xs font-bold text-gray-500 hover:text-primary-600 hover:border-primary-400 transition">
                      <PlusCircle className="w-4 h-4"/> Dodaj postavko ročno
                    </button>

                    {goods.map((item, idx) => (
                      <div key={item.id} className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-3 relative group shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-black text-gray-400 uppercase">Blago #{idx+1}</span>
                          <button onClick={() => removeGoods(item.id)} className="text-gray-300 hover:text-red-500 transition"><X className="w-3.5 h-3.5"/></button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="col-span-2"><input value={item.description} onChange={e=>updateGoods(item.id,'description',e.target.value)} placeholder="Opis blaga *" className="input-field text-xs"/></div>
                          <div className="flex gap-1">
                            <input type="number" value={item.quantity} onChange={e=>updateGoods(item.id,'quantity',parseFloat(e.target.value)||0)} className="input-field text-xs w-16" min={0}/>
                            <select value={item.unit} onChange={e => updateGoods(item.id,'unit',e.target.value)} className="input-field text-xs flex-1">
                               {['box','bag','pallet','drum','container','piece','tonne','litre'].map(u=><option key={u}>{u}</option>)}
                            </select>
                          </div>
                          <div className="flex items-center gap-1">
                            <input type="number" value={item.weight} onChange={e=>updateGoods(item.id,'weight',parseFloat(e.target.value)||0)} className="input-field text-xs" min={0} step={0.1}/>
                            <span className="text-[10px] text-gray-400 font-bold shrink-0">kg</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Accordion>

                {/* Step 5: Predloge & Izpis */}
                <Accordion title="5. Predloge & Izpis" index={4} icon={<Settings className="w-4 h-4"/>}>
                  <div className="space-y-4">
                    <div>
                      <label className="label-xs">CMR Predloga proge (Route Template)</label>
                      <select onChange={e => applyTemplate(e.target.value)} className="input-field border-l-4 border-l-primary-500 font-bold">
                        <option value="">— Ročni vnos —</option>
                        {Object.keys(templates).map(k => <option key={k} value={k}>{templates[k].name}</option>)}
                      </select>
                    </div>

                    <div className="bg-gray-50 dark:bg-slate-800 rounded-xl p-3 border border-gray-100 dark:border-slate-700">
                      <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider mb-2">Nastavitve tiskanja</p>
                      <Toggle value={printLoadingList} onChange={setPrintLoadingList} label="Natisni z Loading List-om"/>
                      <Toggle value={useCustomTemplate} onChange={setUseCustomTemplate} label="Uporabi Custom CMR Predlogo"/>
                      {useCustomTemplate && customCmrTemplates.length === 0 && (
                        <p className="text-[10px] text-amber-600 mt-1">⚠ Nimate naložene nobene predloge.</p>
                      )}
                    </div>
                  </div>
                </Accordion>
              </div>

              {/* Generate button */}
              <div className="p-4 border-t border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-900/50 shrink-0">
                <button 
                  onClick={handleGenerate} 
                  disabled={isGenerating}
                  className={`w-full py-4 rounded-2xl font-black shadow-2xl flex flex-col items-center justify-center transition-all duration-300 active:scale-95 group 
                    ${isGenerating 
                      ? 'bg-slate-200 dark:bg-slate-800 cursor-not-allowed opacity-50' 
                      : (goods.length === 0 || !currentUser)
                        ? 'bg-amber-100 hover:bg-amber-200 text-amber-900 ring-2 ring-amber-200'
                        : 'bg-gradient-to-br from-primary-600 to-primary-700 hover:from-primary-500 hover:to-primary-600 text-white shadow-primary-500/30'}`}
                >
                  <div className="flex items-center gap-3">
                    {isGenerating ? <div className="w-5 h-5 border-2 border-slate-400 border-t-white rounded-full animate-spin"/> : <Printer className="w-6 h-6 group-hover:scale-110 transition-transform"/>}
                    <span className="text-sm tracking-tight">GENERIRAJ CMR DOKUMENT</span>
                  </div>
                  {goods.length === 0 ? (
                    <span className="text-[9px] font-bold mt-1 text-amber-600 flex items-center gap-1"><AlertTriangle className="w-3 h-3"/> Dodajte blago</span>
                  ) : !currentUser ? (
                    <span className="text-[9px] font-bold mt-1 text-amber-600 flex items-center gap-1"><Users className="w-3 h-3"/> Izberite uporabnika</span>
                  ) : (
                    <span className="text-[9px] opacity-70 mt-1 uppercase tracking-widest">{currentUser.initials} • {String(formData.startCmr).padStart(4,'0')}</span>
                  )}
                </button>
              </div>
            </div>

            {/* Preview Area */}
            <div className="flex-1 bg-gray-100 dark:bg-[#0f172a] p-4 md:p-8 flex flex-col overflow-auto items-center">
              {!generatedPdf ? (
                <div className="w-full max-w-[800px] flex flex-col items-center">
                  {/* Blank CMR preview mockup - A4 Aspect Ratio */}
                  <div className="relative bg-white shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-gray-300 w-full aspect-[210/297] overflow-hidden flex flex-col origin-top shrink-0" style={{fontFamily:'Arial, sans-serif', fontSize: '10px', maxWidth: '640px'}}>
                    {/* PREVIEW watermark */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-10" style={{transform:'rotate(-22deg)'}}>
                      <span className="text-gray-50/50 font-black tracking-widest uppercase" style={{fontSize:'80px'}}>PREVIEW</span>
                    </div>
                    {/* Header */}
                    <div className="flex border-b-2 border-black">
                      <div className="flex-1 p-3 border-r border-black">
                        <div className="text-[7px] font-black text-gray-500 uppercase tracking-wider mb-1">1. Sender</div>
                        <div className="text-[9px] text-gray-600 whitespace-pre-wrap min-h-[40px]">{formData.sender || <span className="text-gray-300 italic">Enter sender in the form</span>}</div>
                      </div>
                      <div className="w-48 p-2 flex flex-col items-center justify-center border-r border-black bg-gray-50">
                        <div className="text-2xl font-black tracking-widest text-gray-800">CMR</div>
                        <div className="text-[7px] text-gray-500 text-center leading-tight mt-0.5">International Consignment Note</div>
                        <div className="mt-2 text-[7px] font-bold text-gray-400 uppercase">Document No.</div>
                        <div className="mt-0.5 border border-dashed border-gray-300 rounded w-full text-center py-1 text-[10px] font-mono font-bold text-primary-600">
                          {currentUser ? `${currentUser.initials}${String(formData.startCmr).padStart(7,'0')}` : '??0000001'}
                        </div>
                      </div>
                      <div className="flex-1 p-3">
                        <div className="text-[7px] font-black text-gray-500 uppercase tracking-wider mb-1">3. Consignee</div>
                        <div className="text-[9px] text-gray-600 whitespace-pre-wrap min-h-[40px]">{formData.consignee || <span className="text-gray-300 italic">Enter consignee in the form</span>}</div>
                      </div>
                    </div>
                    {/* Row 2 */}
                    <div className="flex border-b border-gray-300">
                      <div className="flex-1 p-3 border-r border-gray-300">
                        <div className="text-[7px] font-black text-gray-500 uppercase tracking-wider mb-0.5">4. Place of Delivery</div>
                        <div className="text-[9px] text-gray-600">{formData.delivery || <span className="text-gray-300 italic">—</span>}</div>
                      </div>
                      <div className="flex-1 p-3 border-r border-gray-300">
                        <div className="text-[7px] font-black text-gray-500 uppercase tracking-wider mb-0.5">17. Carrier</div>
                        <div className="text-[9px] text-gray-600 whitespace-pre-wrap">{formData.carrier || <span className="text-gray-300 italic">—</span>}</div>
                      </div>
                      <div className="flex-1 p-3">
                        <div className="text-[7px] font-black text-gray-500 uppercase tracking-wider mb-0.5">Plate / Date</div>
                        <div className="text-[9px] text-gray-700 font-bold">{formData.plate || '—'}</div>
                        <div className="text-[9px] text-gray-500">{formData.date}</div>
                      </div>
                    </div>
                    {/* Goods table */}
                    <div className="border-b border-gray-300">
                      <div className="grid grid-cols-5 bg-gray-100 border-b border-gray-300">
                        {['Marks & Nos','Description of Goods','Qty / Unit','Weight (kg)','HS Code'].map(h => (
                          <div key={h} className="p-1.5 text-[7px] font-black text-gray-500 uppercase border-r border-gray-300 last:border-r-0">{h}</div>
                        ))}
                      </div>
                      {goods.length === 0 ? (
                        Array.from({length:3}).map((_,i) => (
                          <div key={i} className="grid grid-cols-5 border-t border-gray-100">
                            {[0,1,2,3,4].map(j => (
                              <div key={j} className="p-2 h-7 border-r border-dashed border-gray-100 last:border-r-0 text-[8px] text-gray-200">—</div>
                            ))}
                          </div>
                        ))
                      ) : goods.slice(0,8).map(item => (
                        <div key={item.id} className="grid grid-cols-5 border-t border-gray-100">
                          <div className="p-1.5 text-[8px] text-gray-600 border-r border-gray-200 truncate">{item.marks||'—'}</div>
                          <div className="p-1.5 text-[8px] text-gray-700 font-semibold border-r border-gray-200 truncate">{item.description}</div>
                          <div className="p-1.5 text-[8px] text-gray-600 border-r border-gray-200">{item.quantity} {item.unit}</div>
                          <div className="p-1.5 text-[8px] text-gray-600 border-r border-gray-200">{item.weight} kg</div>
                          <div className="p-1.5 text-[8px] text-gray-500">{item.hsCode||'—'}</div>
                        </div>
                      ))}
                      {goods.length > 8 && (
                        <div className="p-2 text-[8px] text-gray-400 text-center border-t border-dashed border-gray-200">+{goods.length-8} more items</div>
                      )}
                    </div>
                    {/* Totals row */}
                    <div className="flex border-b border-gray-300 bg-gray-50">
                      <div className="flex-1 p-2 border-r border-gray-300 text-[7px] text-gray-500 font-bold uppercase">Total Items: {goods.length}</div>
                      <div className="flex-1 p-2 border-r border-gray-300 text-[7px] text-gray-500 font-bold uppercase">Total Weight: {goods.reduce((s,g)=>s+(g.weight||0),0).toFixed(1)} kg</div>
                      <div className="flex-1 p-2"/>
                    </div>
                    {/* Signatures */}
                    <div className="flex">
                      {['Sender Signature & Stamp','Carrier Signature & Stamp','Consignee Signature'].map(s => (
                        <div key={s} className="flex-1 p-3 border-r border-gray-200 last:border-r-0">
                          <div className="text-[7px] font-bold text-gray-400 uppercase mb-2">{s}</div>
                          <div className="h-12 border border-dashed border-gray-200 rounded"/>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="mt-6 flex flex-col items-center gap-4">
                    {pdfReadyToSave && !isSavedToHistory && (
                      <button 
                        onClick={handleSaveToHistory}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-xl shadow-emerald-500/20 animate-bounce active:scale-95 transition"
                      >
                        <Save className="w-5 h-5" /> SHRENI V ZGODOVINO
                      </button>
                    )}
                    
                    {isSavedToHistory && (
                      <div className="flex items-center gap-2 text-emerald-500 font-bold bg-emerald-500/10 px-4 py-2 rounded-xl border border-emerald-500/20">
                        <Check className="w-4 h-4" /> Shranjeno v zgodovino
                      </div>
                    )}

                    <div className="flex items-center gap-2 bg-white/5 backdrop-blur-md px-5 py-2.5 rounded-full border border-white/10 shadow-xl">
                      <p className="text-[11px] font-medium text-gray-400">← Fill in the form and click <span className="font-bold text-primary-500">Generate CMR</span> to export the real PDF</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-1 w-full max-w-[900px] flex flex-col items-center gap-4">
                   {pdfReadyToSave && !isSavedToHistory && (
                      <button 
                        onClick={handleSaveToHistory}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-xl shadow-emerald-500/20 active:scale-95 transition"
                      >
                        <Save className="w-5 h-5" /> SHRENI V ZGODOVINO
                      </button>
                    )}
                  <iframe src={generatedPdf || undefined} className="flex-1 w-full rounded-2xl shadow-[0_40px_100px_rgba(0,0,0,0.5)] bg-white border border-gray-300 dark:border-slate-800"/>
                  <button onClick={() => { setGeneratedPdf(null); setPdfReadyToSave(null); setIsSavedToHistory(false); }} className="text-xs font-bold text-gray-500 hover:text-white transition uppercase tracking-widest">Zapri predogled</button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══ TAB: TEMPLATES ═══ */}
        {activeTab === 'templates' && (
          <div className={`flex-1 overflow-y-auto p-8 ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>

            {/* Standard templates */}
            <h2 className="text-xl font-black mb-2 flex items-center gap-2"><Copy className="w-5 h-5 text-primary-500"/> Route Templates</h2>
            <p className={`text-xs mb-5 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>Quick-fill templates for common routes. Click a card to apply it to the form.</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
              {Object.keys(templates).length === 0 && (
                <div className={`col-span-3 text-center py-10 rounded-xl border-2 border-dashed text-sm ${isDark ? 'border-slate-700 text-slate-500' : 'border-gray-200 text-gray-400'}`}>No route templates saved yet.</div>
              )}
              {Object.keys(templates).map(k => (
                <div key={k}
                  onClick={() => applyTemplate(k)}
                  className={`group rounded-xl p-5 border cursor-pointer shadow-sm hover:shadow-md transition-all ${isDark ? 'bg-slate-800 border-slate-700 hover:border-primary-600' : 'bg-white border-gray-200 hover:border-primary-400'}`}>
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <h3 className={`font-bold truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>{templates[k].name}</h3>
                      <span className={`inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full font-bold ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-gray-100 text-gray-500'}`}>{templates[k].country || 'Custom'}</span>
                    </div>
                    <button onClick={e => { e.stopPropagation(); const next = {...templates}; delete next[k]; setTemplates(next); }}
                      className="text-gray-300 hover:text-red-500 transition opacity-0 group-hover:opacity-100 ml-2 shrink-0">
                      <X className="w-4 h-4"/>
                    </button>
                  </div>
                  <p className={`text-xs mt-3 line-clamp-2 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>{templates[k].consignee || <span className="italic">No consignee set</span>}</p>
                  <div className={`mt-3 text-[10px] font-bold flex items-center gap-1 transition group-hover:text-primary-500 ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                    <Check className="w-3 h-3"/> Click to apply
                  </div>
                </div>
              ))}
            </div>

            {/* Custom CMR Templates */}
            <h2 className="text-xl font-black mb-2 flex items-center gap-2"><Pencil className="w-5 h-5 text-primary-500"/> Custom CMR Templates</h2>
            <p className={`text-xs mb-5 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>Upload a scanned CMR form PDF, then draw field boxes to define where each data field is printed. Useful for dot-matrix printers with pre-printed CMR paper.</p>

            {editingTemplateId ? (
              /* ─ Field editor ─ */
              <div className={`border rounded-2xl overflow-hidden ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-200'}`}>
                <div className={`border-b px-5 py-3 flex items-center justify-between ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-gray-50 border-gray-200'}`}>
                  <span className="font-bold text-sm">Editing: {customCmrTemplates.find(t=>t.id===editingTemplateId)?.name}</span>
                  <div className="flex items-center gap-2">
                    <button onClick={saveTemplateFields} className="flex items-center gap-1.5 bg-primary-600 hover:bg-primary-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition">
                      <Save className="w-3.5 h-3.5"/> Save Fields
                    </button>
                    <button onClick={() => setEditingTemplateId(null)} className="text-gray-400 hover:text-gray-700 transition p-1"><X className="w-4 h-4"/></button>
                  </div>
                </div>

                <div className="flex gap-0 overflow-hidden" style={{height: 840}}>
                  {/* Left: Add field control */}
                  <div className={`w-64 border-r p-4 overflow-y-auto shrink-0 ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
                    <p className={`text-[10px] font-black uppercase mb-3 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>Add Field</p>
                    <div className="space-y-1.5 mb-4">
                      <label className="label-xs">Field Type</label>
                      <select value={pendingFieldKey} onChange={e=>setPendingFieldKey(e.target.value)} className="input-field text-xs">
                        {TEMPLATE_FIELD_KEYS.map(f=><option key={f.key} value={f.key}>{f.label}</option>)}
                      </select>
                    </div>
                    <p className={`text-[10px] mb-4 ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>Draw a rectangle on the PDF (right panel) to place this field.</p>

                    <p className={`text-[10px] font-black uppercase mb-2 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>Defined Fields ({editFields.length})</p>
                    <div className="space-y-1">
                      {editFields.map(f => (
                        <div key={f.id} className={`flex items-center justify-between px-2 py-1.5 rounded-lg ${isDark ? 'bg-slate-800' : 'bg-gray-50'}`}>
                          <span className="text-[10px] font-bold text-emerald-600">{f.name}</span>
                          <button onClick={() => setEditFields(prev => prev.filter(x=>x.id!==f.id))} className="text-gray-300 hover:text-red-500"><X className="w-3 h-3"/></button>
                        </div>
                      ))}
                    </div>

                    {pendingRect && (
                      <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3">
                        <p className="text-[10px] font-bold text-amber-700 mb-2">Confirm field placement?</p>
                        <div className="flex gap-2">
                          <button onClick={() => {
                            const fieldDef = TEMPLATE_FIELD_KEYS.find(f=>f.key===pendingFieldKey);
                            const newField: TemplateField = {
                              id: Date.now().toString(), name: fieldDef?.label||pendingFieldKey,
                              fieldKey: pendingFieldKey, x: pendingRect.x, y: pendingRect.y, fontSize: 9
                            };
                            (newField as any).w = pendingRect.w; (newField as any).h = pendingRect.h;
                            setEditFields(prev=>[...prev, newField]);
                            setPendingRect(null);
                          }} className="bg-emerald-600 text-white px-2 py-1 rounded text-xs font-bold flex items-center gap-1"><Check className="w-3 h-3"/> Add</button>
                          <button onClick={()=>setPendingRect(null)} className={`px-2 py-1 rounded text-xs font-bold ${isDark ? 'bg-slate-700 text-slate-200' : 'bg-gray-200 text-gray-700'}`}>Cancel</button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right: Canvas + PDF */}
                  <div className={`flex-1 overflow-auto relative ${isDark ? 'bg-slate-950' : 'bg-gray-100'}`}>
                    <div className="relative inline-block" style={{width:595, height:840}}>
                      {templateBlobUrl && (
                        <iframe src={templateBlobUrl} style={{width:595,height:840,border:'none',display:'block',pointerEvents:'none'}}/>
                      )}
                      {!templateBlobUrl && (
                        <div className={`absolute inset-0 flex items-center justify-center ${isDark ? 'bg-slate-900 text-slate-400' : 'bg-white text-gray-400'}`}>
                          <p className="text-sm">No template PDF loaded</p>
                        </div>
                      )}
                      <canvas
                        ref={canvasRef} width={595} height={840}
                        className="absolute top-0 left-0 cursor-crosshair"
                        style={{touchAction:'none'}}
                        onMouseDown={e=>{const p=canvasPos(e);setIsDrawing(true);setDrawStart(p);setCurrentRect(null);}}
                        onMouseMove={e=>{if(!isDrawing)return;const p=canvasPos(e);setCurrentRect({x:Math.min(drawStart.x,p.x),y:Math.min(drawStart.y,p.y),w:Math.abs(p.x-drawStart.x),h:Math.abs(p.y-drawStart.y)});}}
                        onMouseUp={e=>{
                          if(!isDrawing)return;setIsDrawing(false);
                          if(currentRect&&currentRect.w>8&&currentRect.h>8){
                            const c=canvasRef.current!;
                            setPendingRect({x:(currentRect.x/c.width)*100,y:(currentRect.y/c.height)*100,w:(currentRect.w/c.width)*100,h:(currentRect.h/c.height)*100});
                          }
                          setCurrentRect(null);
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* ─ Template list ─ */
              <div>
                <label className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-500 text-white px-4 py-2.5 rounded-xl text-sm font-bold cursor-pointer transition shadow-md mb-6">
                  <Upload className="w-4 h-4"/> Upload Scanned CMR Template (PDF)
                  <input type="file" className="hidden" accept=".pdf" onChange={handleTemplatePdfUpload}/>
                </label>
                {customCmrTemplates.length === 0 && (
                  <div className={`text-center py-10 rounded-xl border-2 border-dashed text-sm ${isDark ? 'border-slate-700 text-slate-500' : 'border-gray-200 text-gray-400'}`}>No custom templates yet. Upload a scanned CMR PDF above.</div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {customCmrTemplates.map(t => (
                    <div key={t.id} className={`border rounded-xl p-4 shadow-sm ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`}>
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className={`font-bold text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>{t.name}</h3>
                          <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>{t.fields.length} fields defined</p>
                        </div>
                        <button onClick={()=>setCustomCmrTemplates(prev=>prev.filter(x=>x.id!==t.id))} className="text-gray-300 hover:text-red-500"><X className="w-4 h-4"/></button>
                      </div>
                      <button onClick={()=>{setEditingTemplateId(t.id);setEditFields(t.fields);}} className="text-xs font-bold text-primary-600 hover:underline flex items-center gap-1">
                        <Pencil className="w-3 h-3"/> Edit Field Positions
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══ TAB: SETTINGS ═══ */}
        {activeTab === 'settings' && (
          <div className={`flex-1 overflow-y-auto p-8 ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
            <h2 className="text-xl font-black mb-6 flex items-center gap-2"><Settings className="w-5 h-5 text-primary-500"/> Settings &amp; Users</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

              {/* Users */}
              <div className={`rounded-2xl p-5 border shadow-sm ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`}>
                <div className="flex items-center gap-2 mb-5">
                  <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center"><Users className="w-4 h-4"/></div>
                  <h3 className={`font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Users</h3>
                </div>
                <div className="flex gap-2 mb-4">
                  <input id="uName" placeholder="Full Name" className="input-field flex-1 text-xs"/>
                  <input id="uInit" placeholder="AB" maxLength={3} className="input-field w-14 text-center uppercase font-bold text-xs"/>
                  <button onClick={() => {
                    const ni = document.getElementById('uName') as HTMLInputElement;
                    const ii = document.getElementById('uInit') as HTMLInputElement;
                    if(ni.value && ii.value){const nu={id:Date.now().toString(),name:ni.value,initials:ii.value.toUpperCase(),nextCmr:1};setUsers(u=>[...u,nu]);setCurrentUser(nu);ni.value='';ii.value='';}
                  }} className="bg-primary-600 hover:bg-primary-500 text-white px-3 rounded-lg font-bold text-xs transition">Add</button>
                </div>
                <div className={`space-y-2 border-t pt-3 ${isDark ? 'border-slate-700' : 'border-gray-100'}`}>
                  {users.length === 0 && (
                    <p className={`text-xs text-center py-3 ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>No users yet. Add one above.</p>
                  )}
                  {users.map(u => (
                    <div key={u.id}
                      className={`flex justify-between items-center p-2.5 rounded-lg cursor-pointer transition border ${
                        currentUser?.id===u.id
                          ? 'bg-primary-50 border-primary-200 text-primary-700'
                          : isDark ? 'bg-slate-900 border-slate-700 hover:bg-slate-800 text-white' : 'bg-gray-50 border-transparent hover:bg-gray-100 text-gray-800'
                      }`}
                      onClick={() => {setCurrentUser(u);setFormData(p=>({...p,startCmr:u.nextCmr}));}}>
                      <div>
                        <p className="font-bold text-sm">{u.name}</p>
                        <p className={`text-[10px] font-mono ${isDark && currentUser?.id!==u.id ? 'text-slate-400' : 'text-gray-500'}`}>Initials: {u.initials} | Next CMR: {u.nextCmr}</p>
                      </div>
                      <button onClick={e=>{e.stopPropagation();setUsers(prev=>prev.filter(x=>x.id!==u.id));if(currentUser?.id===u.id)setCurrentUser(null);}} className="text-gray-300 hover:text-red-500 transition"><Trash2 className="w-3.5 h-3.5"/></button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Branding */}
              <div className={`rounded-2xl p-5 border shadow-sm ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`}>
                <div className="flex items-center gap-2 mb-5">
                  <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center"><FileText className="w-4 h-4"/></div>
                  <h3 className={`font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Branding</h3>
                </div>
                {(['logo','sign'] as const).map(key => (
                  <div key={key} className="mb-4">
                    <label className="label-xs capitalize">{key === 'logo' ? 'Company Logo' : 'Signature'}</label>
                    {settings[key] ? (
                      <div className="relative inline-block">
                        <img src={settings[key]!} alt={key} className="h-16 border border-gray-200 rounded-lg object-contain bg-white p-1"/>
                        <button onClick={()=>setSettings(s=>({...s,[key]:null}))} className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center"><X className="w-3 h-3"/></button>
                      </div>
                    ) : (
                      <label className={`flex items-center gap-2 px-3 py-2 border-2 border-dashed rounded-lg cursor-pointer hover:border-primary-400 transition w-fit ${isDark ? 'border-slate-600' : 'border-gray-300'}`}>
                        <Upload className="w-4 h-4 text-gray-400"/>
                        <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>Upload {key === 'logo' ? 'logo' : 'signature'} (PNG)</span>
                        <input type="file" className="hidden" accept="image/png,image/jpeg" onChange={e=>handleImageUpload(key,e)}/>
                      </label>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ═══ TAB: HISTORY ═══ */}
        {activeTab === 'history' && (
          <div className={`flex-1 overflow-y-auto p-8 ${isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
            <div className="max-w-6xl mx-auto">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                  <h2 className="text-2xl font-black flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary-500 text-white flex items-center justify-center shadow-lg shadow-primary-500/20">
                      <HistoryIcon className="w-5 h-5"/>
                    </div>
                    Zgodovina generiranja
                  </h2>
                  <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Pregled in upravljanje z vsemi vašimi CMR dokumenti.</p>
                </div>
                
                <div className="flex items-center gap-3">
                  {selectedIds.length > 0 && (
                    <button 
                      onClick={downloadZip}
                      disabled={isZipping}
                      className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-lg shadow-indigo-500/20 transition disabled:opacity-50"
                    >
                      {isZipping ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : <FileArchive className="w-4 h-4"/>}
                      Prenesi ZIP ({selectedIds.length})
                    </button>
                  )}

                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input 
                      type="text" 
                      placeholder="Išči po št., destinaciji, uporabniku..." 
                      value={historySearch}
                      onChange={e => setHistorySearch(e.target.value)}
                      className={`pl-10 pr-4 py-2.5 rounded-xl text-xs font-medium border transition-all w-[300px] outline-none focus:ring-2 focus:ring-primary-500/50 ${
                        isDark ? 'bg-slate-900 border-slate-800 text-white placeholder:text-slate-600' : 'bg-white border-gray-200 text-gray-900'
                      }`}
                    />
                  </div>
                </div>
              </div>

              <div className={`rounded-2xl shadow-xl border overflow-hidden ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-100'}`}>
                <table className="w-full text-left text-xs">
                  <thead className={`uppercase font-bold tracking-wider ${isDark ? 'bg-slate-800/50 text-slate-400 border-b border-slate-800' : 'bg-gray-50 text-gray-500 border-b border-gray-100'}`}>
                    <tr>
                      <th className="p-4 w-10">
                        <input 
                          type="checkbox" 
                          className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                          checked={selectedIds.length === filteredHistory.length && filteredHistory.length > 0}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedIds(filteredHistory.map(h => h.id));
                            else setSelectedIds([]);
                          }}
                        />
                      </th>
                      <th className="p-4">Datum</th>
                      <th className="p-4">Uporabnik</th>
                      <th className="p-4">CMR Št.</th>
                      <th className="p-4">Tip</th>
                      <th className="p-4">Destinacija</th>
                      <th className="p-4 text-right">Akcije</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${isDark ? 'divide-slate-800' : 'divide-gray-50'}`}>
                    {filteredHistory.length === 0 ? (
                      <tr><td colSpan={7} className={`p-16 text-center text-sm ${isDark ? 'text-slate-600' : 'text-gray-400'}`}>Ni ujemajočih zapisov.</td></tr>
                    ) : filteredHistory.map((h,i) => (
                      <tr key={i} className={`group transition ${isDark ? 'hover:bg-slate-800/40' : 'hover:bg-gray-50/50'}`}>
                        <td className="p-4">
                          <input 
                            type="checkbox" 
                            className="rounded border-gray-300 dark:border-slate-700 bg-transparent text-primary-600 focus:ring-primary-500"
                            checked={selectedIds.includes(h.id)}
                            onChange={(e) => {
                              if (e.target.checked) setSelectedIds(prev => [...prev, h.id]);
                              else setSelectedIds(prev => prev.filter(x => x !== h.id));
                            }}
                          />
                        </td>
                        <td className={`p-4 font-medium ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>{new Date(h.date).toLocaleDateString()}</td>
                        <td className={`p-4`}>
                          <div className="flex items-center gap-2">
                             <div className="w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 flex items-center justify-center text-[10px] font-bold uppercase">{h.user.charAt(0)}</div>
                             <span className="font-bold">{h.user}</span>
                          </div>
                        </td>
                        <td className="p-4 font-mono font-bold text-primary-500">#{h.id}</td>
                        <td className="p-4">
                           <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                             h.cargoType === 'adr' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                             h.cargoType === 'frigo' ? 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400' :
                             'bg-gray-100 text-gray-700 dark:bg-slate-800 dark:text-slate-400'
                           }`}>
                             {h.cargoType ? CARGO_TYPE_LABELS[h.cargoType as CargoType] : 'General'}
                           </span>
                        </td>
                        <td className={`p-4 truncate max-w-[200px] font-medium ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>{h.dest}</td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              title="Download PDF"
                              onClick={async()=>{
                                const blob = await get(`cmr_pdf_${h.id}`);
                                if(blob){const a=document.createElement('a');a.href=URL.createObjectURL(blob as Blob);a.download=`CMR_${h.id}.pdf`;a.click();}
                                else alert('PDF ni več na voljo v lokalni shrambi.');
                            }} className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 transition shadow-sm">
                              <Download className="w-3.5 h-3.5"/>
                            </button>
                            <button 
                              title="Delete Record"
                              onClick={() => openDeleteModal(h.id)}
                              className="p-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 transition shadow-sm">
                              <Trash2 className="w-3.5 h-3.5"/>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Delete Confirmation Modal */}
            {showDeleteModal && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in text-center">
                <div className={`w-full max-w-md rounded-3xl p-8 shadow-2xl scale-in ${isDark ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}`}>
                  <div className="w-16 h-16 rounded-2xl bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto mb-6 shadow-lg">
                    <ShieldAlert className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-black mb-2 uppercase">Varnostno potrjevanje</h3>
                  <p className={`text-sm mb-6 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Ali ste prepričani, da želite dokončno izbrisati CMR dokument zapisa <b>#{deleteTargetId}</b>? Te akcije ni mogoče razveljaviti.
                  </p>
                  
                  <div className="mb-6 bg-slate-100 dark:bg-slate-800 rounded-2xl p-4">
                    <p className="text-[10px] uppercase font-bold text-slate-500 mb-1">Prepišite varnostno kodo:</p>
                    <div className="text-3xl font-black tracking-[0.5em] text-primary-500 select-none mb-3 font-mono">{deleteCode}</div>
                    <input 
                      type="text" 
                      maxLength={6}
                      value={deleteInput}
                      onChange={e => setDeleteInput(e.target.value)}
                      placeholder="Vnesite 6 mest"
                      className={`w-full text-center py-3 rounded-xl font-mono text-xl font-bold border outline-none focus:ring-2 focus:ring-red-500 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 transition ${deleteInput === deleteCode ? 'border-emerald-500 ring-emerald-500 text-emerald-500' : ''}`}
                    />
                  </div>

                  <div className="flex flex-col gap-3">
                    <button 
                      onClick={confirmDelete}
                      disabled={deleteInput !== deleteCode}
                      className="w-full py-4 rounded-xl bg-red-600 text-white font-black text-sm uppercase tracking-wider hover:bg-red-500 transition shadow-lg shadow-red-500/20 disabled:opacity-30 active:scale-95"
                    >
                      Potrdi Brisanje
                    </button>
                    <button 
                      onClick={() => setShowDeleteModal(false)}
                      className={`w-full py-3 rounded-xl font-bold text-sm uppercase tracking-wider transition ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
                    >
                      Prekliči
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

      </main>

    </div>
  );
}
