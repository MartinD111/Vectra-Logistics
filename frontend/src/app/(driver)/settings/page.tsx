'use client';

import { useAuth } from '@/context/AuthContext';
import { Settings2, LogOut, User, Phone, Mail, Shield, ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback } from 'react';

function SettingsRow({
  icon: Icon,
  label,
  value,
  onClick,
  danger,
}: {
  icon: React.ElementType;
  label: string;
  value?: string;
  onClick?: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`
        w-full flex items-center gap-4 px-4 py-4
        transition-colors active:bg-slate-700/60
        ${danger ? 'text-red-400' : 'text-white'}
        ${!onClick ? 'cursor-default' : ''}
      `}
    >
      <Icon size={22} className={danger ? 'text-red-400' : 'text-slate-400'} strokeWidth={1.8} />
      <div className="flex-1 text-left min-w-0">
        <p className={`font-semibold text-sm ${danger ? 'text-red-400' : 'text-white'}`}>{label}</p>
        {value && <p className="text-slate-400 text-xs mt-0.5 truncate">{value}</p>}
      </div>
      {onClick && (
        <ChevronRight size={16} className={danger ? 'text-red-400/50' : 'text-slate-600'} />
      )}
    </button>
  );
}

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = useCallback(() => {
    logout();
    router.replace('/auth');
  }, [logout, router]);

  return (
    <div className="flex flex-col px-0 pt-6 pb-4 gap-6">

      {/* Header */}
      <div className="flex items-center gap-2 px-4 mb-1">
        <Settings2 size={20} className="text-slate-400" />
        <h1 className="text-xl font-black tracking-tight">Settings</h1>
      </div>

      {/* Profile card */}
      {user && (
        <section className="mx-4 rounded-2xl bg-slate-800 border border-slate-700 overflow-hidden">
          <div className="flex items-center gap-4 p-4 border-b border-slate-700">
            <div className="w-14 h-14 rounded-full bg-primary-900 border-2 border-primary-600 flex items-center justify-center text-primary-300 font-black text-xl shrink-0">
              {user.first_name[0]}{user.last_name[0]}
            </div>
            <div className="min-w-0">
              <p className="text-lg font-black leading-tight truncate">
                {user.first_name} {user.last_name}
              </p>
              <p className="text-xs text-slate-400 mt-0.5 capitalize">{user.role}</p>
            </div>
          </div>

          <div className="divide-y divide-slate-700/60">
            <SettingsRow
              icon={Mail}
              label="Email"
              value={user.email}
            />
            <SettingsRow
              icon={User}
              label="Account ID"
              value={user.id.slice(0, 16) + '…'}
            />
            {user.company_id && (
              <SettingsRow
                icon={Shield}
                label="Company ID"
                value={user.company_id.slice(0, 16) + '…'}
              />
            )}
          </div>
        </section>
      )}

      {/* App info */}
      <section className="mx-4 rounded-2xl bg-slate-800 border border-slate-700 overflow-hidden">
        <div className="px-4 pt-3 pb-1">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500">App</p>
        </div>
        <div className="divide-y divide-slate-700/60">
          <SettingsRow
            icon={Phone}
            label="Version"
            value="Driver Terminal v1.0"
          />
        </div>
      </section>

      {/* Danger zone */}
      <section className="mx-4 rounded-2xl bg-red-950/30 border border-red-900/40 overflow-hidden">
        <SettingsRow
          icon={LogOut}
          label="Sign Out"
          onClick={handleLogout}
          danger
        />
      </section>

    </div>
  );
}
