'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';
import {
  AlertCircle, ArrowLeft, Hash, Loader2, Package, Scale, Truck, Weight,
} from 'lucide-react';
import { useVehicle, useUpdateVehicle } from '@vectra/data';
import { ApiError } from '@/lib/api/client';
import { FileUploader, DocumentList } from '@vectra/data';
import type { Vehicle } from '@vectra/data';

export default function VehicleDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const router = useRouter();
  const { data: v, isLoading, error } = useVehicle(id);
  const update = useUpdateVehicle(id ?? '');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<Vehicle>>({});
  const [saveError, setSaveError] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-10 flex items-center gap-3 text-slate-500">
        <Loader2 className="w-5 h-5 animate-spin" /> Loading vehicle…
      </div>
    );
  }

  if (error || !v) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-700 dark:text-red-300">Vehicle not found</p>
            <Link href="/fleet/management" className="text-sm text-primary-600 underline mt-2 inline-block">← Back to fleet</Link>
          </div>
        </div>
      </div>
    );
  }

  async function save() {
    setSaveError(null);
    try {
      await update.mutateAsync({
        ...form,
        max_weight_kg: form.max_weight_kg !== undefined ? Number(form.max_weight_kg) : undefined,
        max_volume_m3: form.max_volume_m3 !== undefined ? Number(form.max_volume_m3) : undefined,
        max_pallets: form.max_pallets !== undefined ? Number(form.max_pallets) : undefined,
      });
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
          <div className="w-12 h-12 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
            <Truck className="w-6 h-6 text-primary-600 dark:text-primary-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold dark:text-white font-mono">{v.license_plate}</h1>
            <p className="text-xs text-slate-500">{v.vehicle_type}</p>
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
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">Specifications</h2>
          <Field icon={Hash} label="Licence plate" value={v.license_plate} editable={editing}
            onChange={(val) => setForm((p) => ({ ...p, license_plate: val }))} />
          <Field icon={Truck} label="Vehicle type" value={v.vehicle_type} editable={editing}
            onChange={(val) => setForm((p) => ({ ...p, vehicle_type: val }))} />
          <Field icon={Weight} label="Max weight (kg)" type="number" value={String(v.max_weight_kg)} editable={editing}
            onChange={(val) => setForm((p) => ({ ...p, max_weight_kg: Number(val) }))} />
          <Field icon={Scale} label="Max volume (m³)" type="number" value={String(v.max_volume_m3)} editable={editing}
            onChange={(val) => setForm((p) => ({ ...p, max_volume_m3: Number(val) }))} />
          <Field icon={Package} label="Max pallets" type="number" value={String(v.max_pallets)} editable={editing}
            onChange={(val) => setForm((p) => ({ ...p, max_pallets: Number(val) }))} />
        </div>

        <div className="saas-card space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">Documents</h2>
          <DocumentList subject="vehicle" subjectId={v.id} emptyMessage="No vehicle documents on file yet." />
          <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
            <FileUploader
              subject="vehicle"
              subjectId={v.id}
              allowedTypes={['registration', 'insurance', 'inspection', 'other']}
              showDates
              label="Upload vehicle document"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  icon: Icon, label, value, editable, onChange, type = 'text',
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  editable: boolean;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1.5">
        <Icon className="w-3.5 h-3.5" /> {label}
      </p>
      {editable ? (
        <input type={type} className="saas-input" defaultValue={value} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <p className="font-medium text-slate-800 dark:text-white">{value || '—'}</p>
      )}
    </div>
  );
}
