'use client';

// Shared "Add client" modal — extracted from CrmClientsBlock.tsx's inline form
// so the CRM dashboard (and any future entry point) can reuse the same
// field set/validation without duplicating the form markup.

import { useState } from 'react';
import { X } from 'lucide-react';
import { useCreateClient } from '@/lib/hooks/useCrm';

const COUNTRIES = ['SI', 'DE', 'AT', 'IT', 'HR', 'HU', 'FR', 'NL', 'BE', 'PL', 'CZ', 'SK', 'ES', 'RS', 'CH', 'GB', 'TR'];

interface AddClientModalProps {
  open: boolean;
  onClose: () => void;
}

export function AddClientModal({ open, onClose }: AddClientModalProps) {
  const create = useCreateClient();
  const [name, setName] = useState('');
  const [country, setCountry] = useState('DE');
  const [vatId, setVatId] = useState('');
  const [limit, setLimit] = useState('10000');
  const [rate, setRate] = useState('');

  if (!open) return null;

  const reset = () => {
    setName('');
    setCountry('DE');
    setVatId('');
    setLimit('10000');
    setRate('');
  };

  const submit = () => {
    if (!name.trim()) return;
    create.mutate(
      {
        name: name.trim(),
        country,
        vat_id: vatId.trim() || null,
        credit_limit: Number(limit) || 10000,
        default_rate_eur: rate ? Number(rate) : null,
      },
      {
        onSuccess: () => {
          reset();
          onClose();
        },
      }
    );
  };

  return (
    <div
      className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="saas-card max-w-md w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white">Add client</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Client name"
            className="saas-input !py-1.5 text-sm col-span-2"
          />
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="saas-input !py-1.5 text-sm"
          >
            {COUNTRIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <input
            value={vatId}
            onChange={(e) => setVatId(e.target.value)}
            placeholder="VAT ID (e.g. DE811907980)"
            className="saas-input !py-1.5 text-sm"
          />
          <input
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            type="number"
            placeholder="Credit limit €"
            className="saas-input !py-1.5 text-sm"
          />
          <input
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            type="number"
            placeholder="Default rate € (optional)"
            className="saas-input !py-1.5 text-sm"
          />
        </div>

        <button
          onClick={submit}
          disabled={!name.trim() || create.isPending}
          className="w-full mt-3 py-1.5 rounded-lg bg-primary-600 text-white text-xs font-semibold hover:bg-primary-700 disabled:opacity-60"
        >
          {create.isPending ? 'Adding…' : 'Add client'}
        </button>
      </div>
    </div>
  );
}
