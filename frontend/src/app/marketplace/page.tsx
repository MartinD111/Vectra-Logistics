"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";
import { ShieldCheck, Star } from "lucide-react";
import MapProvider from "@/components/map/MapProvider";

// Dynamically import map to avoid SSR 'window is not defined' issue
const MapComponent = dynamic(() => import("@/components/map/VectraMap"), {
  ssr: false,
});

// ─── Mock match data ───────────────────────────────────────────────────────────
const mockMatches = [
  {
    id: 1,
    route: "Ljubljana → Munich",
    type: "Truck",
    matchScore: 85,
    available: "15m³",
    departure: "2h",
    carrier: {
      id: 1,
      name: "TransEurope Logistics",
      rating: 4.8,
      shipmentsCompleted: 1284,
      isVerified: true,
    },
  },
  {
    id: 2,
    route: "Warsaw → Berlin",
    type: "Truck",
    matchScore: 78,
    available: "22m³",
    departure: "5h",
    carrier: {
      id: 2,
      name: "NordFreight Sp.z.o.o.",
      rating: 4.6,
      shipmentsCompleted: 892,
      isVerified: true,
    },
  },
  {
    id: 3,
    route: "Prague → Vienna",
    type: "Van",
    matchScore: 71,
    available: "8m³",
    departure: "Tomorrow",
    carrier: {
      id: 3,
      name: "CentroCargo s.r.o.",
      rating: 4.3,
      shipmentsCompleted: 456,
      isVerified: false,
    },
  },
];

// ─── Inline star display ───────────────────────────────────────────────────────
function InlineStar({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
      <Star className="w-3 h-3 fill-yellow-400 text-yellow-400 flex-shrink-0" />
      {rating.toFixed(1)}
    </span>
  );
}

// ─── Match card ────────────────────────────────────────────────────────────────
function MatchCard({ match }: { match: (typeof mockMatches)[number] }) {
  const { carrier } = match;

  return (
    <div className="bg-slate-50 dark:bg-slate-800 border dark:border-dark-border p-3 rounded-xl flex items-start gap-3 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer transition-colors shadow-sm">
      {/* Match score badge */}
      <div className="flex-shrink-0 bg-primary-100 dark:bg-primary-900/50 text-primary-800 dark:text-primary-300 px-2.5 py-2 rounded-full font-black text-sm border border-primary-200 dark:border-primary-800 leading-none text-center min-w-[48px]">
        {match.matchScore}%
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Route + type */}
        <p className="font-semibold text-sm dark:text-white leading-tight">
          {match.route}
          <span className="text-xs text-primary-600 dark:text-primary-400 tracking-wider uppercase ml-1.5">
            ({match.type})
          </span>
        </p>

        {/* Capacity / departure */}
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Available: {match.available} | Departs in {match.departure}
        </p>

        {/* Trust signals row */}
        <div className="flex flex-wrap items-center gap-2 mt-2">
          {/* Carrier name → company profile link */}
          <Link
            href={`/company/${carrier.id}`}
            onClick={(e) => e.stopPropagation()}
            className="text-xs font-semibold text-primary-700 dark:text-primary-400 hover:underline truncate max-w-[120px]"
          >
            {carrier.name}
          </Link>

          {/* Star rating */}
          <InlineStar rating={carrier.rating} />

          {/* Shipments done */}
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium tabular-nums">
            {carrier.shipmentsCompleted.toLocaleString()} done
          </span>

          {/* Verified badge */}
          {carrier.isVerified ? (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-900/30 border border-primary-200 dark:border-primary-800 px-1.5 py-0.5 rounded-full">
              <ShieldCheck className="w-3 h-3 flex-shrink-0" />
              Verified
            </span>
          ) : (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 px-1.5 py-0.5 rounded-full">
              Unverified
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────
export default function MarketplacePage() {
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [highRatingOnly, setHighRatingOnly] = useState(false);
  const [minShipments, setMinShipments] = useState(false);

  return (
    <div className="flex h-[calc(100vh-64px)] w-full">
      {/* ── Left side filters ─────────────────────────────────────────────── */}
      <div className="w-80 bg-white dark:bg-dark-card border-r dark:border-dark-border shadow-soft z-20 overflow-y-auto p-6 flex flex-col gap-6 transition-colors">
        <h2 className="text-xl font-bold dark:text-white">Filters</h2>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Origin
          </label>
          <input
            type="text"
            className="saas-input py-2"
            placeholder="City or Postal Code"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Destination
          </label>
          <input
            type="text"
            className="saas-input py-2"
            placeholder="City or Postal Code"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Date
          </label>
          <input type="date" className="saas-input py-2" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Weight (kg)
            </label>
            <input
              type="number"
              className="saas-input py-2"
              placeholder="e.g. 500"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Pallets
            </label>
            <input
              type="number"
              className="saas-input py-2"
              placeholder="e.g. 2"
            />
          </div>
        </div>

        {/* ── Trust Filters ───────────────────────────────────────────────── */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary-500" />
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
              Trust Filters
            </h3>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-dark-border rounded-xl p-4 flex flex-col gap-3">
            {/* Verified companies only */}
            <label className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={verifiedOnly}
                onChange={(e) => setVerifiedOnly(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 dark:border-slate-500 text-primary-600 focus:ring-primary-500 cursor-pointer"
              />
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-primary-500 flex-shrink-0" />
                <span className="text-sm text-slate-700 dark:text-slate-200 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors font-medium">
                  Verified companies only
                </span>
              </div>
            </label>

            {/* Rating 4.5+ */}
            <label className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={highRatingOnly}
                onChange={(e) => setHighRatingOnly(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 dark:border-slate-500 text-primary-600 focus:ring-primary-500 cursor-pointer"
              />
              <div className="flex items-center gap-1.5">
                <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400 flex-shrink-0" />
                <span className="text-sm text-slate-700 dark:text-slate-200 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors font-medium">
                  Rating 4.5+ stars
                </span>
              </div>
            </label>

            {/* 100+ shipments */}
            <label className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={minShipments}
                onChange={(e) => setMinShipments(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 dark:border-slate-500 text-primary-600 focus:ring-primary-500 cursor-pointer"
              />
              <span className="text-sm text-slate-700 dark:text-slate-200 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors font-medium">
                100+ completed shipments
              </span>
            </label>
          </div>
        </div>

        <button className="saas-button mt-2">Apply Filters</button>

        {/* Ad block for non-subs */}
        <div className="mt-auto bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-dark-border h-40 flex items-center justify-center text-xs text-slate-500 italic rounded-xl px-4 text-center">
          Upgrade to Subscriber to remove advertisements
        </div>
      </div>

      {/* ── Center interactive map ─────────────────────────────────────────── */}
      <div className="flex-1 relative z-0">
        <MapProvider>
          <MapComponent />
        </MapProvider>

        {/* Floating results panel (Uber-style bottom/side overlay) */}
        <div className="absolute bottom-8 right-8 w-96 max-h-[60vh] overflow-y-auto saas-card !p-4 flex flex-col gap-3 animate-slide-up bg-white/95 dark:bg-dark-card/95 backdrop-blur-md">
          <div className="flex items-center justify-between border-b pb-2 dark:border-dark-border">
            <h3 className="font-bold dark:text-white">Suggested Matches</h3>
            <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">
              {mockMatches.length} found
            </span>
          </div>

          {mockMatches.map((match) => (
            <MatchCard key={match.id} match={match} />
          ))}
        </div>
      </div>
    </div>
  );
}
