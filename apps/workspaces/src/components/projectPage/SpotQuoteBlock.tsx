'use client';

// Spot quote calculator block: origin + destination + equipment → break-even
// rate and a margin-suggested rate, with the full cost breakdown. Calls
// POST /fleet/spot-quote; origins/destinations autocomplete from the supported
// city list.

import { useState } from 'react';
import { Loader2, Calculator } from 'lucide-react';
import type { SpotQuoteBlock as SpotQuoteBlockType } from '@/lib/projectPage/blocks';
import { useQuoteCities, useSpotQuote } from '@/lib/hooks/useFleet';
import type { SpotQuoteEquipment } from '@/lib/api/fleet.api';

const EQUIPMENT: { value: SpotQuoteEquipment; label: string }[] = [
  { value: 'tautliner', label: 'Tautliner' },
  { value: 'mega', label: 'Mega' },
  { value: 'reefer', label: 'Reefer' },
  { value: 'container', label: 'Container' },
];

const eur = (n: number) => `€${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

export function SpotQuoteView({ block }: { block: SpotQuoteBlockType }) {
  const { data: cities } = useQuoteCities();
  const quote = useSpotQuote();
  const [origin, setOrigin] = useState('Ljubljana');
  const [destination, setDestination] = useState('Munich');
  const [equipment, setEquipment] = useState<SpotQuoteEquipment>('tautliner');

  const result = quote.data;

  return (
    <div className="saas-card !p-4">
      <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-1.5">
        <Calculator className="w-4 h-4 text-gray-400" /> {block.title || 'Spot quote'}
      </h3>

      <datalist id={`spotquote-cities-${block.id}`}>
        {(cities ?? []).map((c) => <option key={c.name} value={c.name}>{c.name} ({c.country})</option>)}
      </datalist>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label-xs">Origin</label>
          <input list={`spotquote-cities-${block.id}`} value={origin} onChange={(e) => setOrigin(e.target.value)}
            className="saas-input !py-2 text-sm" placeholder="Origin city" />
        </div>
        <div>
          <label className="label-xs">Destination</label>
          <input list={`spotquote-cities-${block.id}`} value={destination} onChange={(e) => setDestination(e.target.value)}
            className="saas-input !py-2 text-sm" placeholder="Destination city" />
        </div>
      </div>
      <div className="mt-2">
        <label className="label-xs">Equipment</label>
        <select value={equipment} onChange={(e) => setEquipment(e.target.value as SpotQuoteEquipment)}
          className="saas-input !py-2 text-sm">
          {EQUIPMENT.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
        </select>
      </div>

      <button
        onClick={() => quote.mutate({ origin, destination, equipment, margin_pct: block.defaultMarginPct })}
        disabled={quote.isPending || !origin || !destination}
        className="mt-3 w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 disabled:opacity-60">
        {quote.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />} Calculate
      </button>

      {quote.isError && (
        <p className="mt-2 text-xs text-red-500">{(quote.error as Error)?.message ?? 'Could not calculate a quote.'}</p>
      )}

      {result && (
        <div className="mt-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-gray-50 dark:bg-slate-800/60 p-2.5">
              <p className="label-xs">Break-even</p>
              <p className="text-lg font-black text-gray-900 dark:text-white">{eur(result.break_even_eur)}</p>
              <p className="text-[10px] text-gray-400">{result.break_even_eur_per_km.toFixed(2)} €/km</p>
            </div>
            <div className="rounded-lg bg-primary-50 dark:bg-primary-900/20 p-2.5">
              <p className="label-xs text-primary-700 dark:text-primary-300">Suggested (+{result.margin_pct}%)</p>
              <p className="text-lg font-black text-primary-700 dark:text-primary-300">{eur(result.suggested_rate_eur)}</p>
              <p className="text-[10px] text-primary-400">{result.distance_km} km · {result.days} day{result.days > 1 ? 's' : ''}</p>
            </div>
          </div>
          <div className="rounded-lg border border-gray-100 dark:border-slate-800 p-2.5 space-y-1">
            {[
              ['Fuel', result.breakdown.fuel_eur, `${result.breakdown.consumption_l_100km} L/100km @ €${result.breakdown.fuel_price_eur_l}/L`],
              ['Tolls', result.breakdown.tolls_eur, `€${result.breakdown.toll_rate_eur_km}/km`],
              ['Driver', result.breakdown.driver_eur, `${result.days} day${result.days > 1 ? 's' : ''}`],
              ['Overhead', result.breakdown.overhead_eur, 'tyres, maintenance, depreciation'],
            ].map(([label, value, hint]) => (
              <div key={label as string} className="flex items-center justify-between text-xs">
                <span className="text-gray-600 dark:text-gray-300">{label}<span className="text-gray-400 ml-1.5">{hint}</span></span>
                <span className="font-semibold text-gray-900 dark:text-white">{eur(value as number)}</span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-gray-400 leading-snug">{result.note}</p>
        </div>
      )}
    </div>
  );
}
