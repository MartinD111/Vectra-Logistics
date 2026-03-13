'use client';

import { useState, useEffect, useRef } from 'react';
import {
  FileText, Copy, Settings, History as HistoryIcon,
  Sun, Moon, Users, Upload, Trash2, Printer, MapPin,
  Package, Layers, AlertTriangle, Snowflake, ChevronsUp,
  ChevronDown, PlusCircle, Check, X, Pencil, Save, Download
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { get, set } from 'idb-keyval';
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
  { type: 'general',   label: 'General Cargo',               desc: 'Boxes, pallets, industrial goods', icon: <Package className="w-4 h-4"/>,       color: 'text-blue-600' },
  { type: 'bulk',      label: 'Bulk Cargo',                  desc: 'Grain, sand, liquids, granules',   icon: <Layers className="w-4 h-4"/>,        color: 'text-amber-600' },
  { type: 'adr',       label: 'Dangerous Goods (ADR)',       desc: 'Flammable, toxic, corrosive',      icon: <AlertTriangle className="w-4 h-4"/>, color: 'text-red-600' },
  { type: 'frigo',     label: 'Temperature Controlled',      desc: 'Fresh food, pharma, medical',      icon: <Snowflake className="w-4 h-4"/>,     color: 'text-cyan-600' },
  { type: 'oversized', label: 'Oversized Cargo',             desc: 'Machinery, wind turbines, prefab', icon: <ChevronsUp className="w-4 h-4"/>,    color: 'text-purple-600' },
];

const DEFAULT_TEMPLATES: Record<string, any> = {
  'Sample EU':   { name: 'Sample EU',   country: 'EU', sender: 'Your Company Name\nYour Address\nCity, Country', consignee: 'Receiver Company\nReceiver Address\nCity, Country', delivery: 'Receiver warehouse', instructions: '' },
  'Sample EX':   { name: 'Sample EX',   country: 'EX', sender: '', consignee: '', delivery: '', instructions: '' },
};

/* ── Main Component ── */
export default function CmrWorkspace() {
  const [isDark, setIsDark] = useState(false);
  const [activeTab, setActiveTab] = useState<'production'|'templates'|'settings'|'history'>('production');
  const [activeSubTab, setActiveSubTab] = useState<'details'|'goods'>('details');
  const [cargoType, setCargoType] = useState<CargoType>('general');
  const [cargoDropOpen, setCargoDropOpen] = useState(false);
  const [printLoadingList, setPrintLoadingList] = useState(true);
  const [useCustomTemplate, setUseCustomTemplate] = useState(false);
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
    adrClass: '', temperature: '', specialNotes: '',
  });
  const [goods, setGoods] = useState<GoodsItem[]>([]);
  const [generatedPdf, setGeneratedPdf] = useState<string|null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

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
      const newItems: GoodsItem[] = rows.map(r => ({
        id: Date.now().toString() + Math.random(),
        marks: r.Marks || r.marks || '',
        description: r.Description || r.description || '',
        quantity: parseFloat(r.Quantity || r.quantity) || 1,
        unit: r.Unit || r.unit || 'box',
        weight: parseFloat(r['Weight(kg)'] || r.weight) || 0,
        hsCode: r.HSCode || r.hsCode || '',
      })).filter(x => x.description.length > 0);
      setGoods(g => [...g, ...newItems]);
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  /* ── Generate PDF ── */
  const handleGenerate = async () => {
    if (!currentUser) return alert('Please add and select a User in Settings first.');
    if (goods.length === 0) return alert('Please add at least one goods item.');
    setIsGenerating(true);
    try {
      const cmrId = `${currentUser.initials}${String(formData.startCmr).padStart(7,'0')}`;
      const data: CmrData = {
        sender: formData.sender, consignee: formData.consignee,
        delivery: formData.delivery, loading: formData.loading,
        carrier: formData.carrier, instr: formData.instr,
        date: new Date(formData.date).toLocaleDateString('en-GB'),
        plate: formData.plate, cmrId,
        cargoType, adrClass: formData.adrClass,
        temperature: formData.temperature, specialNotes: formData.specialNotes,
      };

      let blob: Blob;
      if (useCustomTemplate) {
        const activeTemplate = customCmrTemplates[0];
        if (!activeTemplate) return alert('No custom template configured. Please upload one in the Templates tab.');
        blob = await createCustomTemplatePdf(activeTemplate.fields, data, goods);
      } else {
        blob = await createCmrPdf(goods, cmrId, data, settings, currentUser, printLoadingList);
      }

      await set(`cmr_pdf_${cmrId}`, blob);
      const entry = { id: cmrId, date: new Date().toISOString(), user: currentUser.name, count: goods.length, dest: formData.consignee.split('\n')[0], cargoType };
      setHistory(h => [entry, ...h]);
      const updated = { ...currentUser, nextCmr: currentUser.nextCmr + 1 };
      setUsers(u => u.map(x => x.id === currentUser.id ? updated : x));
      setCurrentUser(updated);
      setFormData(p => ({...p, startCmr: updated.nextCmr}));
      setGeneratedPdf(URL.createObjectURL(blob));
    } catch (err) {
      console.error(err); alert('Error generating CMR document.');
    } finally { setIsGenerating(false); }
  };

  const applyTemplate = (id: string) => {
    const t = templates[id]; if (!t) return;
    setFormData(p => ({...p, sender: t.sender||'', consignee: t.consignee||'', delivery: t.delivery||'', instr: t.instructions||''}));
  };

  const selectedCargo = CARGO_TYPES.find(c => c.type === cargoType)!;

  /* ── Toggle component ── */
  const Toggle = ({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) => (
    <div className="flex items-center justify-between py-2">
      <span className="text-xs font-bold text-gray-600 dark:text-gray-400">{label}</span>
      <button
        onClick={() => onChange(!value)}
        className={`w-10 h-5 rounded-full transition-colors relative ${value ? 'bg-primary-500' : 'bg-gray-200 dark:bg-slate-700'}`}
      >
        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${value ? 'left-5' : 'left-0.5'}`}/>
      </button>
    </div>
  );

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
    <div className={`min-h-[calc(100vh-80px)] flex flex-col ${isDark ? 'dark bg-slate-950 text-slate-50' : 'bg-slate-50 text-slate-900'}`}>

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
            <div className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">{currentUser.name}</div>
          ) : (
            <div className="text-xs font-bold px-2.5 py-1 rounded-full bg-orange-100 text-orange-700 animate-pulse">No User Selected</div>
          )}
          <button onClick={() => setIsDark(v => !v)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition">
            {isDark ? <Sun className="w-4 h-4 text-gray-400"/> : <Moon className="w-4 h-4 text-gray-500"/>}
          </button>
        </div>
      </header>

      {/* MAIN */}
      <main className="flex-1 flex overflow-hidden" onClick={() => cargoDropOpen && setCargoDropOpen(false)}>

        {/* ═══ TAB: PRODUCTION ═══ */}
        {activeTab === 'production' && (
          <div className="flex w-full h-full">

            {/* Sidebar */}
            <div className="w-[420px] bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-800 flex flex-col shadow-lg z-10 shrink-0">
              <div className="p-4 overflow-y-auto flex-1">

                {/* Date + CMR No */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div>
                    <label className="label-xs">Date</label>
                    <input type="date" value={formData.date} onChange={e => setFormData(p=>({...p, date: e.target.value}))} className="input-field"/>
                  </div>
                  <div>
                    <label className="label-xs">CMR Number</label>
                    <div className="flex">
                      <div className="bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 border-r-0 px-2 py-1.5 rounded-l-lg text-xs font-bold text-gray-500">
                        {currentUser ? currentUser.initials : 'XX'}
                      </div>
                      <input type="number" value={formData.startCmr} onChange={e => setFormData(p=>({...p, startCmr: parseInt(e.target.value)||1}))}
                        className="w-full border border-gray-200 dark:border-slate-700 rounded-r-lg px-2 py-1.5 text-sm font-mono font-bold text-primary-600 bg-white dark:bg-slate-800 outline-none focus:ring-2 focus:ring-primary-500"/>
                    </div>
                  </div>
                </div>

                {/* Template selector */}
                <div className="mb-4">
                  <label className="label-xs">Route Template</label>
                  <select onChange={e => applyTemplate(e.target.value)} className="input-field border-l-4 border-l-primary-500 font-bold">
                    <option value="">— Manual entry —</option>
                    {Object.keys(templates).map(k => <option key={k} value={k}>{templates[k].name}</option>)}
                  </select>
                </div>

                {/* Print settings */}
                <div className="bg-gray-50 dark:bg-slate-800/50 rounded-xl p-3 mb-4 border border-gray-100 dark:border-slate-700">
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider mb-1">Print Settings</p>
                  <Toggle value={printLoadingList} onChange={setPrintLoadingList} label="Print with Loading List"/>
                  <Toggle value={useCustomTemplate} onChange={setUseCustomTemplate} label="Use Custom CMR Template"/>
                  {useCustomTemplate && customCmrTemplates.length === 0 && (
                    <p className="text-[10px] text-amber-600 mt-1">⚠ No custom template yet — go to the Templates tab to upload one.</p>
                  )}
                </div>

                {/* Sub-tabs */}
                <div className="flex bg-gray-100 dark:bg-slate-800 p-1 rounded-lg mb-4">
                  <button onClick={() => setActiveSubTab('details')}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-md transition flex items-center justify-center gap-1.5 ${activeSubTab==='details' ? 'bg-white dark:bg-slate-700 shadow text-primary-600 dark:text-primary-400' : 'text-gray-500'}`}>
                    <MapPin className="w-3 h-3"/> 1. DETAILS
                  </button>
                  <button onClick={() => setActiveSubTab('goods')}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-md transition flex items-center justify-center gap-1.5 ${activeSubTab==='goods' ? 'bg-white dark:bg-slate-700 shadow text-primary-600 dark:text-primary-400' : 'text-gray-500 dark:text-gray-400'}`}>
                    <Package className="w-3 h-3"/> 2. GOODS ({goods.length})
                  </button>
                </div>

                {/* DETAILS sub-tab */}
                {activeSubTab === 'details' && (
                  <div className="space-y-3">
                    <div><label className="label-xs">Sender</label><textarea rows={3} value={formData.sender} onChange={e=>setFormData(p=>({...p,sender:e.target.value}))} className="input-field"/></div>
                    <div><label className="label-xs">Consignee</label><textarea rows={3} value={formData.consignee} onChange={e=>setFormData(p=>({...p,consignee:e.target.value}))} className="input-field"/></div>
                    <div><label className="label-xs">Place of Delivery</label><textarea rows={2} value={formData.delivery} onChange={e=>setFormData(p=>({...p,delivery:e.target.value}))} className="input-field"/></div>
                    <div><label className="label-xs">Place of Loading</label><input value={formData.loading} onChange={e=>setFormData(p=>({...p,loading:e.target.value}))} className="input-field"/></div>
                    <div><label className="label-xs">Vehicle Plate</label><input value={formData.plate} onChange={e=>setFormData(p=>({...p,plate:e.target.value}))} placeholder="e.g. KP AB-123" className="input-field font-bold"/></div>
                    <div><label className="label-xs">Carrier</label><textarea rows={2} value={formData.carrier} onChange={e=>setFormData(p=>({...p,carrier:e.target.value}))} className="input-field"/></div>

                    {/* Cargo type specific extra fields */}
                    {cargoType === 'adr' && (
                      <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/40 p-3 rounded-lg">
                        <label className="label-xs text-red-600 dark:text-red-400">ADR Classification (UN No., Class, Packing Group)</label>
                        <input value={formData.adrClass} onChange={e=>setFormData(p=>({...p,adrClass:e.target.value}))}
                          placeholder="e.g. UN1203, Class 3, PG II" className="input-field border-red-200 dark:border-red-900/50"/>
                      </div>
                    )}
                    {cargoType === 'frigo' && (
                      <div className="bg-cyan-50 dark:bg-cyan-900/10 border border-cyan-200 dark:border-cyan-900/40 p-3 rounded-lg">
                        <label className="label-xs text-cyan-600 dark:text-cyan-400">Temperature Range</label>
                        <input value={formData.temperature} onChange={e=>setFormData(p=>({...p,temperature:e.target.value}))}
                          placeholder="e.g. +2°C to +8°C" className="input-field border-cyan-200 dark:border-cyan-900/50"/>
                      </div>
                    )}
                    {cargoType === 'oversized' && (
                      <div className="bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-900/40 p-3 rounded-lg">
                        <label className="label-xs text-purple-600 dark:text-purple-400">Special Transport Notes (dimensions, permits)</label>
                        <textarea rows={2} value={formData.specialNotes} onChange={e=>setFormData(p=>({...p,specialNotes:e.target.value}))}
                          placeholder="e.g. Max width 4.5m, escort required" className="input-field border-purple-200 dark:border-purple-900/50"/>
                      </div>
                    )}

                    <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/40 p-3 rounded-lg">
                      <label className="label-xs text-amber-600 dark:text-amber-500">Sender's Instructions</label>
                      <textarea rows={3} value={formData.instr} onChange={e=>setFormData(p=>({...p,instr:e.target.value}))} className="input-field bg-white/50 dark:bg-slate-900/50 border-amber-200 dark:border-amber-900/50"/>
                    </div>
                  </div>
                )}

                {/* GOODS sub-tab */}
                {activeSubTab === 'goods' && (
                  <div className="space-y-3">
                    {/* Import */}
                    <div className="bg-primary-50 dark:bg-primary-900/10 border border-primary-100 dark:border-primary-900/40 rounded-xl p-3 flex items-center gap-3">
                      <Upload className="w-4 h-4 text-primary-600 shrink-0"/>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-gray-700 dark:text-gray-200">Import from Excel</p>
                        <p className="text-[10px] text-gray-500">Columns: Description, Marks, Quantity, Unit, Weight(kg), HSCode</p>
                      </div>
                      <label className="bg-primary-600 hover:bg-primary-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition shrink-0">
                        .xlsx <input type="file" className="hidden" accept=".xlsx,.xls" onChange={handleExcelImport}/>
                      </label>
                    </div>

                    {/* Add item button */}
                    <button onClick={addGoodsItem}
                      className="w-full flex items-center justify-center gap-2 py-2 border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-lg text-xs font-bold text-gray-500 hover:text-primary-600 hover:border-primary-400 transition">
                      <PlusCircle className="w-4 h-4"/> Add Goods Item
                    </button>

                    {/* List */}
                    {goods.length === 0 ? (
                      <div className="text-center py-8 text-xs text-gray-400 border-2 border-dashed border-gray-200 dark:border-slate-700 rounded-xl">
                        No goods added yet
                      </div>
                    ) : goods.map((item, idx) => (
                      <div key={item.id} className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg p-3 relative group">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-black text-gray-400 uppercase">Item #{idx+1}</span>
                          <button onClick={() => removeGoods(item.id)} className="text-gray-300 hover:text-red-500 transition">
                            <X className="w-3.5 h-3.5"/>
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="col-span-2">
                            <input value={item.description} onChange={e=>updateGoods(item.id,'description',e.target.value)}
                              placeholder="Description *" className="input-field text-xs"/>
                          </div>
                          <input value={item.marks} onChange={e=>updateGoods(item.id,'marks',e.target.value)}
                            placeholder="Marks" className="input-field text-xs"/>
                          <input value={item.hsCode} onChange={e=>updateGoods(item.id,'hsCode',e.target.value)}
                            placeholder="HS Code" className="input-field text-xs"/>
                          <div className="flex gap-1">
                            <input type="number" value={item.quantity} onChange={e=>updateGoods(item.id,'quantity',parseFloat(e.target.value)||0)}
                              className="input-field text-xs w-16 shrink-0" min={0}/>
                            <select value={item.unit} onChange={e=>updateGoods(item.id,'unit',e.target.value)}
                              className="input-field text-xs flex-1">
                              {['box','bag','pallet','drum','container','piece','tonne','litre'].map(u=><option key={u}>{u}</option>)}
                            </select>
                          </div>
                          <div className="flex items-center gap-1">
                            <input type="number" value={item.weight} onChange={e=>updateGoods(item.id,'weight',parseFloat(e.target.value)||0)}
                              className="input-field text-xs" min={0} step={0.1}/>
                            <span className="text-[10px] text-gray-400 font-bold shrink-0">kg</span>
                          </div>
                        </div>
                      </div>
                    ))}

                    {goods.length > 0 && (
                      <div className="flex justify-between text-xs text-gray-500 px-1 pt-1 border-t border-gray-100 dark:border-slate-700">
                        <span>{goods.length} items</span>
                        <span className="font-bold">{goods.reduce((s,g)=>s+(g.weight||0),0).toFixed(1)} kg total</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Generate button */}
              <div className="p-4 border-t border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-900/50 shrink-0">
                <button onClick={handleGenerate} disabled={isGenerating||goods.length===0}
                  className="w-full bg-primary-600 hover:bg-primary-500 disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-3 rounded-xl font-bold shadow-lg shadow-primary-500/20 flex items-center justify-center gap-2 transition">
                  {isGenerating ? 'Generating PDF...' : <><Printer className="w-4 h-4"/> Generate CMR Document</>}
                </button>
              </div>
            </div>

            {/* Preview */}
            <div className="flex-1 bg-gray-200 dark:bg-slate-950 p-6 flex flex-col overflow-auto">
              {!generatedPdf ? (
                <div className="flex flex-col items-center">
                  {/* Blank CMR preview mockup */}
                  <div className="relative bg-white rounded-xl shadow-2xl border border-gray-300 w-full overflow-hidden" style={{fontFamily:'Arial, sans-serif', fontSize: '10px', maxWidth: '680px'}}>
                    {/* PREVIEW watermark */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-10" style={{transform:'rotate(-22deg)'}}>
                      <span className="text-gray-100 font-black tracking-widest" style={{fontSize:'72px'}}>PREVIEW</span>
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
                  <p className="text-center text-xs text-gray-400 mt-3">← Fill in the form and click <span className="font-bold text-primary-500">Generate CMR</span> to export the real PDF</p>
                </div>
              ) : (
                <iframe src={generatedPdf} className="flex-1 w-full rounded-xl shadow-2xl bg-white border border-gray-300 dark:border-slate-700"/>
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
          <div className={`flex-1 overflow-y-auto p-8 ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
            <h2 className="text-xl font-black mb-6 flex items-center gap-2"><HistoryIcon className="w-5 h-5 text-primary-500"/> Generation History</h2>
            <div className={`rounded-2xl shadow-sm border overflow-hidden ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`}>
              <table className="w-full text-left text-sm">
                <thead className={`text-xs uppercase font-bold ${isDark ? 'bg-slate-900 text-slate-400' : 'bg-gray-50 text-gray-500'}`}>
                  <tr>
                    <th className="p-4">Date</th>
                    <th className="p-4">User</th>
                    <th className="p-4">CMR No.</th>
                    <th className="p-4">Type</th>
                    <th className="p-4">Items</th>
                    <th className="p-4">Destination</th>
                    <th className="p-4 text-right">PDF</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDark ? 'divide-slate-700' : 'divide-gray-100'}`}>
                  {history.length === 0 ? (
                    <tr><td colSpan={7} className={`p-10 text-center ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>No history yet. Generate a CMR to get started.</td></tr>
                  ) : history.map((h,i) => (
                    <tr key={i} className={`transition ${isDark ? 'hover:bg-slate-700/50' : 'hover:bg-gray-50'}`}>
                      <td className={`p-4 text-xs ${isDark ? 'text-slate-300' : 'text-gray-600'}`}>{new Date(h.date).toLocaleDateString()}</td>
                      <td className={`p-4 font-bold text-xs ${isDark ? 'text-white' : 'text-gray-900'}`}>{h.user}</td>
                      <td className="p-4 font-mono text-primary-500 text-xs">{h.id}</td>
                      <td className={`p-4 text-xs ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>{h.cargoType ? CARGO_TYPE_LABELS[h.cargoType as CargoType] : 'General'}</td>
                      <td className={`p-4 text-xs ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>{h.count}</td>
                      <td className={`p-4 text-xs truncate max-w-[160px] ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>{h.dest}</td>
                      <td className="p-4 text-right">
                        <button onClick={async()=>{
                          const blob = await get(`cmr_pdf_${h.id}`);
                          if(blob){const a=document.createElement('a');a.href=URL.createObjectURL(blob as Blob);a.download=`CMR_${h.id}.pdf`;a.click();}
                          else alert('PDF no longer available in storage.');
                        }} className="text-xs font-bold text-primary-500 hover:underline flex items-center gap-1 ml-auto">
                          <Download className="w-3 h-3"/> Download
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </main>

    </div>
  );
}
