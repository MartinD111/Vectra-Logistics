'use client';

import { useState, useEffect, useRef } from 'react';
import {
  User, Building2, Shield, FileText, Truck, Bell, CreditCard,
  UploadCloud, Eye, EyeOff, Loader2, CheckCircle2, AlertCircle,
  Download, Filter, Trash2, Plus, Edit2, Phone, Mail, X, ChevronRight
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

const TABS = [
  { id: 'overview',      label: 'Overview',      icon: User },
  { id: 'company',       label: 'Company',        icon: Building2 },
  { id: 'security',      label: 'Security',       icon: Shield },
  { id: 'documents',     label: 'Documents',      icon: FileText },
  { id: 'fleet',         label: 'Fleet',          icon: Truck },
  { id: 'notifications', label: 'Notifications',  icon: Bell },
  { id: 'subscription',  label: 'Subscription',   icon: CreditCard },
];

function VerificationBadge({ status }: { status: string }) {
  const map: Record<string, { color: string; label: string }> = {
    pending:  { color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800', label: 'Pending Verification' },
    approved: { color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800',   label: 'Verified' },
    rejected: { color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800',               label: 'Rejected' },
  };
  const { color, label } = map[status] ?? map['pending'];
  return <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${color}`}>{label}</span>;
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${checked ? 'bg-primary-600' : 'bg-gray-200 dark:bg-slate-700'}`}>
      <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  );
}

export default function ProfilePage() {
  const { user, token, logout } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('overview');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Overview
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneVal, setPhoneVal] = useState('');

  // Company
  const [companyName, setCompanyName] = useState('');
  const [companyVat, setCompanyVat] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [companyCity, setCompanyCity] = useState('');
  const [companyCountry, setCompanyCountry] = useState('');
  const [companyPostal, setCompanyPostal] = useState('');
  const [companyStatus, setCompanyStatus] = useState('pending');

  // Security
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [twoFAEnabled, setTwoFAEnabled] = useState(false);

  // Documents
  const [docs, setDocs] = useState<any[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [docFilters, setDocFilters] = useState({ from: '', to: '', license_plate: '', doc_type: '' });

  // Fleet
  const [drivers, setDrivers] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [fleetLoading, setFleetLoading] = useState(false);
  const [showAddDriver, setShowAddDriver] = useState(false);
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [newDriver, setNewDriver] = useState({ first_name: '', last_name: '', phone: '', email: '', license_number: '' });
  const [newVehicle, setNewVehicle] = useState({ license_plate: '', vehicle_type: '', max_weight_kg: '', max_volume_m3: '', max_pallets: '' });

  // Notifications
  const [notifEmail, setNotifEmail] = useState(true);
  const [notifWhatsapp, setNotifWhatsapp] = useState(false);
  const [notifFreq, setNotifFreq] = useState('instant');

  const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
  const authHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  useEffect(() => {
    if (user) {
      setFirstName(user.first_name);
      setLastName(user.last_name);
      setTwoFAEnabled(false);
    }
  }, [user]);

  useEffect(() => {
    if (activeTab === 'company') fetchCompany();
    if (activeTab === 'documents') fetchDocuments();
    if (activeTab === 'fleet') fetchFleet();
    if (activeTab === 'notifications') fetchPreferences();
  }, [activeTab]);

  const showMsg = (type: 'success' | 'error', text: string) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 4000);
  };

  const fetchCompany = async () => {
    try {
      const res = await fetch(`${API}/api/profile/company`, { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        setCompanyName(data.name || '');
        setCompanyVat(data.vat_number || '');
        setCompanyAddress(data.address || '');
        setCompanyCity(data.city || '');
        setCompanyCountry(data.country || '');
        setCompanyPostal(data.postal_code || '');
        setCompanyStatus(data.status || 'pending');
      }
    } catch { }
  };

  const fetchDocuments = async () => {
    setDocsLoading(true);
    try {
      const params = new URLSearchParams(Object.fromEntries(Object.entries(docFilters).filter(([, v]) => v)));
      const res = await fetch(`${API}/api/documents?${params}`, { headers: authHeaders });
      if (res.ok) setDocs(await res.json());
    } catch { } finally { setDocsLoading(false); }
  };

  const fetchFleet = async () => {
    setFleetLoading(true);
    try {
      const [dr, veh] = await Promise.all([
        fetch(`${API}/api/fleet/drivers`, { headers: authHeaders }).then(r => r.json()),
        fetch(`${API}/api/fleet/vehicles`, { headers: authHeaders }).then(r => r.json()),
      ]);
      setDrivers(Array.isArray(dr) ? dr : []);
      setVehicles(Array.isArray(veh) ? veh : []);
    } catch { } finally { setFleetLoading(false); }
  };

  const fetchPreferences = async () => {
    try {
      const res = await fetch(`${API}/api/profile/preferences`, { headers: authHeaders });
      if (res.ok) {
        const d = await res.json();
        setNotifEmail(d.email_notifications ?? true);
        setNotifWhatsapp(d.whatsapp_notifications ?? false);
        setNotifFreq(d.notification_frequency ?? 'instant');
      }
    } catch { }
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/profile`, {
        method: 'PUT', headers: authHeaders,
        body: JSON.stringify({ first_name: firstName, last_name: lastName, phone: phoneVal }),
      });
      if (res.ok) showMsg('success', 'Profile updated successfully!');
      else showMsg('error', 'Failed to update profile.');
    } catch { showMsg('error', 'Network error.'); } finally { setSaving(false); }
  };

  const saveCompany = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/profile/company`, {
        method: 'PUT', headers: authHeaders,
        body: JSON.stringify({ name: companyName, vat_number: companyVat, address: companyAddress, city: companyCity, country: companyCountry, postal_code: companyPostal }),
      });
      if (res.ok) showMsg('success', 'Company details saved!');
      else showMsg('error', 'Failed to save company details.');
    } catch { showMsg('error', 'Network error.'); } finally { setSaving(false); }
  };

  const saveNotifications = async () => {
    setSaving(true);
    try {
      await fetch(`${API}/api/profile/preferences`, {
        method: 'PUT', headers: authHeaders,
        body: JSON.stringify({ email_notifications: notifEmail, whatsapp_notifications: notifWhatsapp, notification_frequency: notifFreq }),
      });
      showMsg('success', 'Notification preferences saved!');
    } catch { showMsg('error', 'Network error.'); } finally { setSaving(false); }
  };

  const addDriver = async () => {
    try {
      const res = await fetch(`${API}/api/fleet/drivers`, { method: 'POST', headers: authHeaders, body: JSON.stringify(newDriver) });
      if (res.ok) { setShowAddDriver(false); setNewDriver({ first_name: '', last_name: '', phone: '', email: '', license_number: '' }); fetchFleet(); showMsg('success', 'Driver added!'); }
    } catch { showMsg('error', 'Failed to add driver.'); }
  };

  const removeDriver = async (id: string) => {
    try {
      await fetch(`${API}/api/fleet/drivers/${id}`, { method: 'DELETE', headers: authHeaders });
      fetchFleet(); showMsg('success', 'Driver removed.');
    } catch { showMsg('error', 'Failed to remove driver.'); }
  };

  const addVehicle = async () => {
    try {
      const res = await fetch(`${API}/api/fleet/vehicles`, { method: 'POST', headers: authHeaders, body: JSON.stringify(newVehicle) });
      if (res.ok) { setShowAddVehicle(false); setNewVehicle({ license_plate: '', vehicle_type: '', max_weight_kg: '', max_volume_m3: '', max_pallets: '' }); fetchFleet(); showMsg('success', 'Vehicle added!'); }
    } catch { showMsg('error', 'Failed to add vehicle.'); }
  };

  const removeVehicle = async (id: string) => {
    try {
      await fetch(`${API}/api/fleet/vehicles/${id}`, { method: 'DELETE', headers: authHeaders });
      fetchFleet(); showMsg('success', 'Vehicle removed.');
    } catch { showMsg('error', 'Failed to remove vehicle.'); }
  };

  const roleBadge = user?.role === 'carrier'
    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
    : user?.role === 'shipper'
    ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400'
    : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex flex-col lg:flex-row gap-8">

        {/* Sidebar */}
        <aside className="lg:w-64 shrink-0">
          <div className="saas-card flex flex-col items-center text-center p-6 mb-4">
            <div className="relative w-20 h-20 mb-4 group cursor-pointer">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-2xl font-black shadow-lg">
                {user ? `${user.first_name[0]}${user.last_name[0]}` : '?'}
              </div>
              <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <UploadCloud className="text-white h-5 w-5" />
              </div>
            </div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white">{user?.first_name} {user?.last_name}</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{user?.email}</p>
            <div className="flex gap-2 mt-3 flex-wrap justify-center">
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${roleBadge}`}>{user?.role}</span>
              {user?.is_verified && (
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">✓ Verified</span>
              )}
            </div>
          </div>

          <nav className="saas-card p-2 space-y-0.5">
            {TABS.filter(t => t.id !== 'fleet' || user?.role === 'carrier').map(tab => {
              const Icon = tab.icon;
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left ${activeTab === tab.id
                    ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-white'}`}>
                  <Icon className="h-4 w-4" />
                  {tab.label}
                  {activeTab === tab.id && <ChevronRight className="h-4 w-4 ml-auto" />}
                </button>
              );
            })}
            <div className="border-t border-gray-100 dark:border-slate-700 pt-1 mt-1">
              <button onClick={logout}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all text-left">
                <X className="h-4 w-4" /> Sign Out
              </button>
            </div>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0">

          {/* Toast */}
          {msg && (
            <div className={`flex items-center gap-3 p-4 rounded-xl mb-6 text-sm border ${msg.type === 'success'
              ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-300'
              : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300'}`}>
              {msg.type === 'success' ? <CheckCircle2 className="h-5 w-5 shrink-0" /> : <AlertCircle className="h-5 w-5 shrink-0" />}
              {msg.text}
            </div>
          )}

          {/* ─── OVERVIEW TAB ─── */}
          {activeTab === 'overview' && (
            <div className="saas-card space-y-6">
              <div className="border-b border-gray-100 dark:border-slate-700 pb-4">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2"><User className="h-5 w-5 text-primary-500" /> Basic Information</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Update your personal information and contact details.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">First name</label>
                  <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} className="saas-input" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Last name</label>
                  <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} className="saas-input" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Email address</label>
                  <input type="email" value={user?.email || ''} disabled className="saas-input opacity-60 cursor-not-allowed" />
                  <p className="text-xs text-gray-400 mt-1">Email changes require re-verification.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Phone number</label>
                  <input type="tel" value={phoneVal} onChange={e => setPhoneVal(e.target.value)} placeholder="+386 41 ..." className="saas-input" />
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <button onClick={saveProfile} disabled={saving} className="saas-button !w-auto px-8">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Changes'}
                </button>
              </div>
            </div>
          )}

          {/* ─── COMPANY TAB ─── */}
          {activeTab === 'company' && (
            <div className="space-y-6">
              <div className="saas-card space-y-6">
                <div className="border-b border-gray-100 dark:border-slate-700 pb-4 flex items-start justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2"><Building2 className="h-5 w-5 text-primary-500" /> Company Details</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Your business registration and contact information.</p>
                  </div>
                  <VerificationBadge status={companyStatus} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Company name</label>
                    <input type="text" value={companyName} onChange={e => setCompanyName(e.target.value)} className="saas-input" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">VAT / Tax number</label>
                    <input type="text" value={companyVat} onChange={e => setCompanyVat(e.target.value)} placeholder="SI12345678" className="saas-input" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Postal code</label>
                    <input type="text" value={companyPostal} onChange={e => setCompanyPostal(e.target.value)} className="saas-input" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Street address</label>
                    <input type="text" value={companyAddress} onChange={e => setCompanyAddress(e.target.value)} className="saas-input" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">City</label>
                    <input type="text" value={companyCity} onChange={e => setCompanyCity(e.target.value)} className="saas-input" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Country</label>
                    <input type="text" value={companyCountry} onChange={e => setCompanyCountry(e.target.value)} className="saas-input" />
                  </div>
                </div>
                <div className="flex justify-end pt-2">
                  <button onClick={saveCompany} disabled={saving} className="saas-button !w-auto px-8">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Company'}
                  </button>
                </div>
              </div>

              {/* Document Upload for Verification */}
              <div className="saas-card">
                <h3 className="text-base font-bold text-gray-900 dark:text-white mb-4">Registration Documents</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">Upload your company registration certificate, trade license, or insurance documents (PDF or image).</p>
                <label className="flex flex-col items-center justify-center w-full h-36 border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-xl cursor-pointer hover:border-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/10 transition">
                  <UploadCloud className="h-8 w-8 text-gray-400 dark:text-gray-500 mb-2" />
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Click to upload PDF or image</span>
                  <span className="text-xs text-gray-400 mt-1">Max 10MB</span>
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" />
                </label>
              </div>
            </div>
          )}

          {/* ─── SECURITY TAB ─── */}
          {activeTab === 'security' && (
            <div className="space-y-6">
              <div className="saas-card space-y-5">
                <div className="border-b border-gray-100 dark:border-slate-700 pb-4">
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2"><Shield className="h-5 w-5 text-primary-500" /> Password</h2>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Current password</label>
                  <div className="relative">
                    <input type={showPwd ? 'text' : 'password'} value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className="saas-input pr-10" />
                    <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                      {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">New password</label>
                  <input type={showPwd ? 'text' : 'password'} value={newPassword} onChange={e => setNewPassword(e.target.value)} className="saas-input" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Confirm new password</label>
                  <input type={showPwd ? 'text' : 'password'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="saas-input" />
                  {newPassword && confirmPassword && newPassword !== confirmPassword && (
                    <p className="text-xs text-red-500 mt-1">Passwords do not match.</p>
                  )}
                </div>
                <div className="flex justify-end">
                  <button className="saas-button !w-auto px-8" disabled={!currentPassword || !newPassword || newPassword !== confirmPassword}>Update Password</button>
                </div>
              </div>

              <div className="saas-card space-y-4">
                <h3 className="text-base font-bold text-gray-900 dark:text-white border-b border-gray-100 dark:border-slate-700 pb-4">Two-Factor Authentication (2FA)</h3>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Authenticator app</p>
                    <p className="text-xs text-gray-400 mt-0.5">Use Google Authenticator or Authy for enhanced security.</p>
                  </div>
                  <Toggle checked={twoFAEnabled} onChange={setTwoFAEnabled} />
                </div>
              </div>

              <div className="saas-card space-y-4">
                <h3 className="text-base font-bold text-gray-900 dark:text-white border-b border-gray-100 dark:border-slate-700 pb-4">Active Sessions</h3>
                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-800 rounded-xl">
                  <div>
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Current session</p>
                    <p className="text-xs text-gray-400 mt-0.5">Windows • Chrome • Ljubljana, SI</p>
                  </div>
                  <span className="text-xs text-green-600 dark:text-green-400 font-semibold bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-full">Active</span>
                </div>
                <button className="text-sm text-red-600 dark:text-red-400 hover:underline font-medium">Log out all other sessions</button>
              </div>

              <div className="saas-card border border-red-200 dark:border-red-900/50">
                <h3 className="text-base font-bold text-red-700 dark:text-red-400 mb-3">Danger Zone</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Permanently delete your account and all associated data. This action cannot be undone.</p>
                <button className="text-sm font-semibold text-red-600 dark:text-red-400 border border-red-300 dark:border-red-800 px-4 py-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition">Request Account Deletion</button>
              </div>
            </div>
          )}

          {/* ─── DOCUMENTS TAB ─── */}
          {activeTab === 'documents' && (
            <div className="saas-card space-y-6">
              <div className="border-b border-gray-100 dark:border-slate-700 pb-4">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2"><FileText className="h-5 w-5 text-primary-500" /> Documents & e-CMR</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">View and download your transport documents.</p>
              </div>
              {/* Filters */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">From date</label>
                  <input type="date" value={docFilters.from} onChange={e => setDocFilters(f => ({ ...f, from: e.target.value }))} className="saas-input !py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">To date</label>
                  <input type="date" value={docFilters.to} onChange={e => setDocFilters(f => ({ ...f, to: e.target.value }))} className="saas-input !py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">License plate</label>
                  <input type="text" placeholder="e.g. LJ1234" value={docFilters.license_plate} onChange={e => setDocFilters(f => ({ ...f, license_plate: e.target.value }))} className="saas-input !py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Type</label>
                  <select value={docFilters.doc_type} onChange={e => setDocFilters(f => ({ ...f, doc_type: e.target.value }))} className="saas-input !py-2 text-sm bg-white dark:bg-slate-800">
                    <option value="">All types</option>
                    <option value="cmr">CMR</option>
                    <option value="invoice">Invoice</option>
                    <option value="proof_of_delivery">Proof of Delivery</option>
                  </select>
                </div>
              </div>
              <button onClick={fetchDocuments} className="flex items-center gap-2 text-sm font-semibold text-primary-600 dark:text-primary-400 hover:underline">
                <Filter className="h-4 w-4" /> Apply Filters
              </button>

              {docsLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary-500" /></div>
              ) : docs.length === 0 ? (
                <div className="text-center py-16 text-gray-400 dark:text-gray-500">
                  <FileText className="h-12 w-12 mx-auto mb-3 opacity-40" />
                  <p className="text-sm">No documents found matching your filters.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {docs.map(doc => (
                    <div key={doc.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-800 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-700 transition">
                      <div>
                        <p className="text-sm font-semibold text-gray-800 dark:text-white capitalize">{doc.document_type}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{doc.license_plate} • {doc.driver_name} • {new Date(doc.created_at).toLocaleDateString()}</p>
                      </div>
                      <a href={`${API}${doc.file_url}`} target="_blank" rel="noreferrer"
                        className="flex items-center gap-1.5 text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline">
                        <Download className="h-4 w-4" /> PDF
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ─── FLEET TAB (Carrier only) ─── */}
          {activeTab === 'fleet' && user?.role === 'carrier' && (
            <div className="space-y-6">
              {/* Drivers */}
              <div className="saas-card space-y-5">
                <div className="border-b border-gray-100 dark:border-slate-700 pb-4 flex items-center justify-between">
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2"><User className="h-5 w-5 text-primary-500" /> Drivers</h2>
                  <button onClick={() => setShowAddDriver(true)} className="flex items-center gap-1.5 text-sm font-semibold text-primary-600 dark:text-primary-400 hover:underline">
                    <Plus className="h-4 w-4" /> Add Driver
                  </button>
                </div>
                {fleetLoading ? <Loader2 className="h-6 w-6 animate-spin text-primary-500" /> : (
                  <div className="space-y-2">
                    {drivers.length === 0 && <p className="text-sm text-gray-400 text-center py-8">No drivers yet. Add your first driver above.</p>}
                    {drivers.map(d => (
                      <div key={d.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-800 rounded-xl">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center text-primary-700 dark:text-primary-300 font-bold text-sm">
                            {d.first_name[0]}{d.last_name[0]}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-800 dark:text-white">{d.first_name} {d.last_name}</p>
                            <p className="text-xs text-gray-400">{d.phone} • {d.license_number || 'No license'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${d.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-gray-400'}`}>{d.status}</span>
                          <button onClick={() => removeDriver(d.id)} className="text-gray-400 hover:text-red-500 transition p-1"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {/* Add Driver Form */}
                {showAddDriver && (
                  <div className="border border-gray-200 dark:border-slate-700 rounded-xl p-4 space-y-3 bg-gray-50 dark:bg-slate-800">
                    <h4 className="text-sm font-bold text-gray-800 dark:text-white">New Driver</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <input type="text" placeholder="First name" value={newDriver.first_name} onChange={e => setNewDriver(d => ({ ...d, first_name: e.target.value }))} className="saas-input !py-2 text-sm" />
                      <input type="text" placeholder="Last name" value={newDriver.last_name} onChange={e => setNewDriver(d => ({ ...d, last_name: e.target.value }))} className="saas-input !py-2 text-sm" />
                      <input type="tel" placeholder="Phone" value={newDriver.phone} onChange={e => setNewDriver(d => ({ ...d, phone: e.target.value }))} className="saas-input !py-2 text-sm" />
                      <input type="text" placeholder="License number" value={newDriver.license_number} onChange={e => setNewDriver(d => ({ ...d, license_number: e.target.value }))} className="saas-input !py-2 text-sm" />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={addDriver} className="saas-button !w-auto px-6 !py-2 text-sm">Add</button>
                      <button onClick={() => setShowAddDriver(false)} className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 px-4 py-2">Cancel</button>
                    </div>
                  </div>
                )}
              </div>

              {/* Vehicles */}
              <div className="saas-card space-y-5">
                <div className="border-b border-gray-100 dark:border-slate-700 pb-4 flex items-center justify-between">
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2"><Truck className="h-5 w-5 text-primary-500" /> Trucks & Trailers</h2>
                  <button onClick={() => setShowAddVehicle(true)} className="flex items-center gap-1.5 text-sm font-semibold text-primary-600 dark:text-primary-400 hover:underline">
                    <Plus className="h-4 w-4" /> Add Vehicle
                  </button>
                </div>
                <div className="space-y-2">
                  {vehicles.length === 0 && <p className="text-sm text-gray-400 text-center py-8">No vehicles yet. Add your first truck above.</p>}
                  {vehicles.map(v => (
                    <div key={v.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-800 rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                          <Truck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-800 dark:text-white">{v.license_plate}</p>
                          <p className="text-xs text-gray-400">{v.vehicle_type} • {v.max_weight_kg}kg • {v.max_pallets} pallets</p>
                        </div>
                      </div>
                      <button onClick={() => removeVehicle(v.id)} className="text-gray-400 hover:text-red-500 transition p-1"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  ))}
                </div>
                {showAddVehicle && (
                  <div className="border border-gray-200 dark:border-slate-700 rounded-xl p-4 space-y-3 bg-gray-50 dark:bg-slate-800">
                    <h4 className="text-sm font-bold text-gray-800 dark:text-white">New Vehicle</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <input type="text" placeholder="License plate" value={newVehicle.license_plate} onChange={e => setNewVehicle(v => ({ ...v, license_plate: e.target.value }))} className="saas-input !py-2 text-sm" />
                      <input type="text" placeholder="Type (e.g. Curtainsider)" value={newVehicle.vehicle_type} onChange={e => setNewVehicle(v => ({ ...v, vehicle_type: e.target.value }))} className="saas-input !py-2 text-sm" />
                      <input type="number" placeholder="Max weight (kg)" value={newVehicle.max_weight_kg} onChange={e => setNewVehicle(v => ({ ...v, max_weight_kg: e.target.value }))} className="saas-input !py-2 text-sm" />
                      <input type="number" placeholder="Pallets" value={newVehicle.max_pallets} onChange={e => setNewVehicle(v => ({ ...v, max_pallets: e.target.value }))} className="saas-input !py-2 text-sm" />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={addVehicle} className="saas-button !w-auto px-6 !py-2 text-sm">Add</button>
                      <button onClick={() => setShowAddVehicle(false)} className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 px-4 py-2">Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ─── NOTIFICATIONS TAB ─── */}
          {activeTab === 'notifications' && (
            <div className="saas-card space-y-6">
              <div className="border-b border-gray-100 dark:border-slate-700 pb-4">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2"><Bell className="h-5 w-5 text-primary-500" /> Notification Preferences</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Control how and when VECTRA contacts you.</p>
              </div>
              <div className="space-y-5">
                <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-slate-700">
                  <div>
                    <p className="text-sm font-semibold text-gray-800 dark:text-white">Email notifications</p>
                    <p className="text-xs text-gray-400 mt-0.5">Match alerts, booking confirmations, CMR updates</p>
                  </div>
                  <Toggle checked={notifEmail} onChange={setNotifEmail} />
                </div>
                <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-slate-700">
                  <div>
                    <p className="text-sm font-semibold text-gray-800 dark:text-white">WhatsApp to drivers</p>
                    <p className="text-xs text-gray-400 mt-0.5">Send pickup details, addresses, and CMR links directly to drivers</p>
                  </div>
                  <Toggle checked={notifWhatsapp} onChange={setNotifWhatsapp} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-800 dark:text-white mb-3">Notification frequency</label>
                  <div className="flex gap-3 flex-wrap">
                    {['instant', 'daily', 'weekly'].map(freq => (
                      <button key={freq} onClick={() => setNotifFreq(freq)}
                        className={`px-5 py-2.5 rounded-xl border-2 text-sm font-medium capitalize transition-all ${notifFreq === freq
                          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                          : 'border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-400 hover:border-primary-300'}`}>
                        {freq}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <button onClick={saveNotifications} disabled={saving} className="saas-button !w-auto px-8">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Preferences'}
                </button>
              </div>
            </div>
          )}

          {/* ─── SUBSCRIPTION TAB ─── */}
          {activeTab === 'subscription' && (
            <div className="space-y-6">
              <div className="saas-card bg-gradient-to-r from-primary-600 to-primary-500 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-primary-100">Current Plan</p>
                    <h2 className="text-2xl font-black mt-1">
                      {user?.subscription === 'active' ? 'Subscriber' : 'Free Tier'}
                    </h2>
                    {user?.subscription === 'active' && (
                      <p className="text-primary-100 text-sm mt-1">3% commission per matched transport (min €15)</p>
                    )}
                  </div>
                  <CreditCard className="h-12 w-12 text-primary-200 opacity-60" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className={`saas-card ${user?.subscription === 'active' ? 'ring-2 ring-primary-500' : 'opacity-70 hover:opacity-100 transition-opacity'}`}>
                  {user?.subscription === 'active' && (
                    <div className="inline-flex text-xs font-bold uppercase tracking-wide bg-primary-500 text-white px-3 py-1 rounded-full mb-4">Current Plan</div>
                  )}
                  <h3 className="text-xl font-black text-gray-900 dark:text-white">Subscriber</h3>
                  <div className="text-4xl font-extrabold text-primary-600 dark:text-primary-400 my-3">3%</div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">commission per transport</p>
                  <ul className="space-y-2 mb-6">
                    {['No advertisements', 'Full CMR & e-CMR access', 'Priority AI matching', 'WhatsApp driver alerts'].map(f => (
                      <li key={f} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                        <CheckCircle2 className="h-4 w-4 text-primary-500 shrink-0" /> {f}
                      </li>
                    ))}
                  </ul>
                  <button disabled={user?.subscription === 'active'} className="saas-button disabled:opacity-50 disabled:cursor-not-allowed">
                    {user?.subscription === 'active' ? 'Active Plan' : 'Upgrade'}
                  </button>
                </div>

                <div className="saas-card">
                  <h3 className="text-xl font-black text-gray-900 dark:text-white">Free Tier</h3>
                  <div className="text-4xl font-extrabold text-gray-500 dark:text-gray-400 my-3">6%</div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">commission per transport</p>
                  <ul className="space-y-2 mb-6">
                    {['Ad-supported platform', 'Basic marketplace access', 'Standard matching'].map(f => (
                      <li key={f} className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                        <div className="h-4 w-4 rounded-full border-2 border-gray-300 dark:border-gray-600 shrink-0" /> {f}
                      </li>
                    ))}
                  </ul>
                  <button disabled={user?.subscription !== 'active'} className="saas-button !bg-transparent !text-primary-600 border-2 !border-primary-600 hover:!bg-primary-50 dark:!text-primary-400 dark:!border-primary-500 disabled:opacity-50 disabled:cursor-not-allowed">
                    {user?.subscription !== 'active' ? 'Current Plan' : 'Downgrade'}
                  </button>
                </div>
              </div>

              <div className="saas-card">
                <h3 className="text-base font-bold text-gray-900 dark:text-white mb-4">Billing History</h3>
                <p className="text-sm text-gray-400 text-center py-6">No payment history available.</p>
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}
