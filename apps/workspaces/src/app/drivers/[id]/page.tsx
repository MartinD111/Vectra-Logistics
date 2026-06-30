'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  AlertCircle, ArrowLeft, CreditCard, Loader2, Mail, Phone, User as UserIcon,
} from 'lucide-react';
import { useState } from 'react';
import { useDriver, useUpdateDriver } from '@vectra/data';
import { ApiError } from '@/lib/api/client';
import { FileUploader, DocumentList } from '@vectra/data';
import type { Driver, UpdateDriverDto } from '@vectra/data';

const STATUS_LABELS: Record<Driver['status'], string> = {
  active: 'Active',
  inactive: 'Inactive',
  on_leave: 'On Leave',
};

export default function DriverDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const router = useRouter();
  const { data: d, isLoading, error } = useDriver(id);
  const update = useUpdateDriver(id ?? '');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<UpdateDriverDto>({});
  const [saveError, setSaveError] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-10 flex items-center gap-3 text-slate-500">
        <Loader2 className="w-5 h-5 animate-spin" /> Loading driver…
      </div>
    );
  }

  if (error || !d) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-700 dark:text-red-300">Driver not found</p>
            <Link href="/fleet/management" className="text-sm text-primary-600 underline mt-2 inline-block">
              ← Back to fleet
            </Link>
          </div>
        </div>
      </div>
    );
  }

  async function save() {
    if (!id) return;
    setSaveError(null);
    try {
      await update.mutateAsync(form);
      setEditing(false); setForm({});
    } catch (e) {
      setSaveError(e instanceof ApiError ? e.message : 'Save failed.');
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
      <button onClick={() => router.back()} className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 inline-flex items-center gap-1 mb-4">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-700 dark:text-primary-300 font-bold">
            {d.first_name[0]}{d.last_name[0]}
          </div>
          <div>
            <h1 className="text-2xl font-bold dark:text-white">{d.first_name} {d.last_name}</h1>
            <p className="text-xs text-slate-500 font-mono">{d.id}</p>
          </div>
        </div>
        <button
          onClick={() => editing ? save() : setEditing(true)}
          disabled={update.isPending}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white text-sm font-semibold rounded-xl"
        >
          {update.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
          {editing ? 'Save changes' : 'Edit'}
        </button>
      </div>

      {saveError && (
        <div className="flex items-start gap-2 p-3 mb-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 dark:text-red-300">{saveError}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="saas-card space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">Contact</h2>
          <Field icon={UserIcon} label="First name" value={d.first_name} editable={editing}
            onChange={(v) => setForm((p) => ({ ...p, first_name: v }))} />
          <Field icon={UserIcon} label="Last name" value={d.last_name} editable={editing}
            onChange={(v) => setForm((p) => ({ ...p, last_name: v }))} />
          <Field icon={Phone} label="Phone" value={d.phone ?? ''} editable={editing}
            onChange={(v) => setForm((p) => ({ ...p, phone: v }))} />
          <Field icon={Mail} label="Email" value={d.email ?? ''} editable={editing}
            onChange={(v) => setForm((p) => ({ ...p, email: v }))} />
          <Field icon={CreditCard} label="Licence number" value={d.license_number ?? ''} editable={editing}
            onChange={(v) => setForm((p) => ({ ...p, license_number: v }))} />
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-500 mb-1">Status</p>
            {editing ? (
              <select className="saas-input" defaultValue={d.status}
                onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as UpdateDriverDto['status'] }))}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="on_leave">On Leave</option>
              </select>
            ) : (
              <p className="font-medium text-slate-800 dark:text-white">{STATUS_LABELS[d.status]}</p>
            )}
          </div>
        </div>

        <div className="saas-card space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">Documents</h2>
          <DocumentList subject="driver" subjectId={d.id} emptyMessage="No documents on file for this driver yet." />
          <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
            <FileUploader
              subject="driver"
              subjectId={d.id}
              allowedTypes={['license', 'adr_certificate', 'tachograph_card', 'medical', 'other']}
              showDates
              label="Upload driver document"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  icon: Icon, label, value, editable, onChange,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  editable: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1.5">
        <Icon className="w-3.5 h-3.5" /> {label}
      </p>
      {editable ? (
        <input className="saas-input" defaultValue={value} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <p className="font-medium text-slate-800 dark:text-white">{value || '—'}</p>
      )}
    </div>
  );
}
