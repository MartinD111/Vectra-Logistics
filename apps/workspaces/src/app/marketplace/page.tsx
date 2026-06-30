"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MapProvider, useCapacities, useShipments, useBookShipment, StatusBadge } from "@vectra/data";
import {
  Map,
  Cpu,
  Package,
  Building2,
  ShieldCheck,
  Star,
  Truck,
  TrendingUp,
  Plus,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  X,
  Filter,
  BarChart3,
  MessageSquare,
  Banknote,
} from "lucide-react";

const MapComponent = dynamic(() => import("@vectra/data/map").then((m) => m.VectraMap), {
  ssr: false,
});

// ─── Types ─────────────────────────────────────────────────────────────────────

type TabId = "matching" | "predictive" | "optimizer" | "companies";

// ─── Mock Data ─────────────────────────────────────────────────────────────────

const mockMatches = [
  {
    id: 1,
    route: "Ljubljana → Munich",
    matchScore: 85,
    cargoType: "Vehicles",
    capacityInfo: "Space for 2 cars",
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
    matchScore: 78,
    cargoType: "General",
    capacityInfo: "13.6m Mega Trailer (Empty)",
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
    matchScore: 71,
    cargoType: "Vehicles",
    capacityInfo: "Space for 1 car",
    carrier: {
      id: 3,
      name: "CentroCargo s.r.o.",
      rating: 4.3,
      shipmentsCompleted: 456,
      isVerified: false,
    },
  },
];

const mockPredictions = [
  {
    id: "T-101",
    route: "Munich → Milan",
    driver: "Hans Mueller",
    emptyNear: "Verona, IT",
    emptyKm: 65,
    completion: 78,
    eta: "~2h 15min",
  },
  {
    id: "T-103",
    route: "Warsaw → Berlin",
    driver: "Piotr Kowalski",
    emptyNear: "Poznan, PL",
    emptyKm: 120,
    completion: 52,
    eta: "~3h 40min",
  },
  {
    id: "T-105",
    route: "Paris → Lyon",
    driver: "Jean Dupont",
    emptyNear: "Dijon, FR",
    emptyKm: 35,
    completion: 91,
    eta: "~45min",
  },
  {
    id: "T-102",
    route: "Prague → Vienna",
    driver: "Pavel Novak",
    emptyNear: "Brno, CZ",
    emptyKm: 45,
    completion: 85,
    eta: "~1h 20min",
  },
];

type CargoItem = {
  id: number;
  description: string;
  quantity: number;
  weight: number;
  length: number;
  width: number;
  height: number;
};

const initialCargoItems: CargoItem[] = [
  {
    id: 1,
    description: "Pallets - Electronics",
    quantity: 8,
    weight: 3200,
    length: 1.2,
    width: 0.8,
    height: 1.0,
  },
  {
    id: 2,
    description: "Boxes - Clothing",
    quantity: 24,
    weight: 1800,
    length: 0.6,
    width: 0.4,
    height: 0.5,
  },
  {
    id: 3,
    description: "Machine Parts",
    quantity: 2,
    weight: 4500,
    length: 2.4,
    width: 1.2,
    height: 1.5,
  },
];

const mockCompanies = [
  {
    id: 1,
    name: "TransEurope Logistics GmbH",
    flag: "🇩🇪",
    country: "Germany",
    isVerified: true,
    rating: 4.8,
    shipments: 1284,
    trucks: 48,
    onTime: 94.1,
    initials: "TL",
    color: "bg-blue-500",
  },
  {
    id: 2,
    name: "NordFreight Sp.z.o.o.",
    flag: "🇵🇱",
    country: "Poland",
    isVerified: true,
    rating: 4.6,
    shipments: 892,
    trucks: 32,
    onTime: 91.3,
    initials: "NF",
    color: "bg-purple-500",
  },
  {
    id: 3,
    name: "CentroCargo s.r.o.",
    flag: "🇨🇿",
    country: "Czech Republic",
    isVerified: false,
    rating: 4.3,
    shipments: 456,
    trucks: 18,
    onTime: 87.2,
    initials: "CC",
    color: "bg-orange-500",
  },
  {
    id: 4,
    name: "AlpeTrans SA",
    flag: "🇨🇭",
    country: "Switzerland",
    isVerified: true,
    rating: 4.9,
    shipments: 2103,
    trucks: 76,
    onTime: 97.4,
    initials: "AT",
    color: "bg-emerald-500",
  },
];

// ─── Shared micro-components ───────────────────────────────────────────────────

function MatchScorePill({ score }: { score: number }) {
  const color =
    score >= 80
      ? "bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300 border-green-200 dark:border-green-800"
      : score >= 70
        ? "bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800"
        : "bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800";
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-black border tabular-nums leading-none ${color}`}
    >
      {score}%
    </span>
  );
}

function VerifiedBadge() {
  return (
    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-900/30 border border-primary-200 dark:border-primary-800 px-1.5 py-0.5 rounded-full whitespace-nowrap">
      <ShieldCheck className="w-3 h-3 flex-shrink-0" />
      Verified
    </span>
  );
}

function UnverifiedBadge() {
  return (
    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 px-1.5 py-0.5 rounded-full whitespace-nowrap">
      Unverified
    </span>
  );
}

function StarRating({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
      <Star className="w-3 h-3 fill-yellow-400 text-yellow-400 flex-shrink-0" />
      {rating.toFixed(1)}
    </span>
  );
}

// ─── Match card ────────────────────────────────────────────────────────────────

function MatchCard({ match, onContact, onOffer }: { match: (typeof mockMatches)[number], onContact: () => void, onOffer: () => void }) {
  const { carrier } = match;
  return (
    <div className="bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 p-3 rounded-xl flex items-start gap-3 hover:bg-white dark:hover:bg-slate-700 cursor-pointer transition-colors">
      <div className="flex-shrink-0 mt-0.5">
        <MatchScorePill score={match.matchScore} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm text-slate-800 dark:text-white leading-tight">
          {match.route}
        </p>
        {match.cargoType && (
          <p className="text-xs text-slate-500 mt-1 font-medium">{match.capacityInfo} • {match.cargoType}</p>
        )}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5">
          <Link
            href={`/company/${carrier.id}`}
            onClick={(e) => e.stopPropagation()}
            className="text-xs font-semibold text-primary-700 dark:text-primary-400 hover:underline truncate max-w-[130px]"
          >
            {carrier.name}
          </Link>
          <StarRating rating={carrier.rating} />
          <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {carrier.shipmentsCompleted.toLocaleString()} done
          </span>
          {carrier.isVerified ? <VerifiedBadge /> : <UnverifiedBadge />}
        </div>
        <div className="flex items-center gap-2 mt-3">
          <button onClick={(e) => { e.stopPropagation(); onContact(); }} className="flex-1 inline-flex justify-center items-center gap-1.5 px-2 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg transition-colors border border-slate-200 dark:border-slate-600">
            <MessageSquare className="w-3.5 h-3.5" />
            Contact
          </button>
          <button onClick={(e) => { e.stopPropagation(); onOffer(); }} className="flex-1 inline-flex justify-center items-center gap-1.5 px-2 py-1.5 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 hover:bg-primary-100 dark:hover:bg-primary-900/40 text-xs font-semibold rounded-lg transition-colors border border-primary-200 dark:border-primary-800/50">
            <Banknote className="w-3.5 h-3.5" />
            Make Offer
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Prediction card ───────────────────────────────────────────────────────────

function PredictionCard({
  prediction,
}: {
  prediction: (typeof mockPredictions)[number];
}) {
  const parts = prediction.route.split(" → ");
  const from = parts[0];
  const to = parts[1];
  return (
    <div className="saas-card flex flex-col gap-4">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-600 font-mono tracking-wide">
            {prediction.id}
          </span>
          <div>
            <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-white text-sm">
              <span>{from}</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 flex-shrink-0" />
              <span>{to}</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Driver:{" "}
              <span className="font-medium text-slate-600 dark:text-slate-300">
                {prediction.driver}
              </span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-700/50 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 flex-shrink-0">
          <Clock className="w-3.5 h-3.5 flex-shrink-0" />
          <span>
            Est. available:{" "}
            <span className="font-semibold text-slate-700 dark:text-slate-200">
              {prediction.eta}
            </span>
          </span>
        </div>
      </div>

      {/* Empty-near callout */}
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-xl p-3">
        <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-0.5">
          Becomes empty near:
        </p>
        <p className="text-sm font-bold text-amber-900 dark:text-amber-200">
          {prediction.emptyNear}{" "}
          <span className="font-normal text-amber-700 dark:text-amber-400">
            · in ~{prediction.emptyKm} km
          </span>
        </p>
      </div>

      {/* Progress bar */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500 dark:text-slate-400">
            Route completion
          </span>
          <span className="font-bold text-slate-700 dark:text-slate-200">
            {prediction.completion}%
          </span>
        </div>
        <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary-500 rounded-full transition-all duration-700"
            style={{ width: `${prediction.completion}%` }}
          />
        </div>
      </div>

      {/* Status + action row */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2 flex-shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-500" />
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400 italic">
            Proactively searching for loads...
          </span>
        </div>
        <button className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white text-xs font-semibold rounded-lg transition-colors flex-shrink-0">
          <Plus className="w-3.5 h-3.5" />
          Suggest Load
        </button>
      </div>
    </div>
  );
}

// ─── Company card ──────────────────────────────────────────────────────────────

function CompanyCard({ company }: { company: (typeof mockCompanies)[number] }) {
  return (
    <div className="saas-card flex flex-col gap-4 hover:shadow-md transition-shadow">
      {/* Avatar + name */}
      <div className="flex items-start gap-3">
        <div
          className={`${company.color} w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-base flex-shrink-0 shadow-sm`}
        >
          {company.initials}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-slate-800 dark:text-white text-sm leading-tight">
            {company.name}
          </h3>
          <div className="flex items-center flex-wrap gap-1.5 mt-1">
            <span className="text-sm leading-none">{company.flag}</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {company.country}
            </span>
            {company.isVerified ? <VerifiedBadge /> : null}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-2 border border-slate-100 dark:border-slate-600">
          <div className="flex items-center justify-center gap-0.5 mb-0.5">
            <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
            <span className="font-bold text-slate-800 dark:text-white text-sm">
              {company.rating.toFixed(1)}
            </span>
          </div>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Rating
          </p>
        </div>
        <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-2 border border-slate-100 dark:border-slate-600">
          <p className="font-bold text-slate-800 dark:text-white text-sm tabular-nums">
            {company.shipments.toLocaleString()}
          </p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Shipments
          </p>
        </div>
        <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-2 border border-slate-100 dark:border-slate-600">
          <p className="font-bold text-slate-800 dark:text-white text-sm">
            {company.trucks}
          </p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Trucks
          </p>
        </div>
      </div>

      {/* On-time bar */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500 dark:text-slate-400">
            On-time delivery rate
          </span>
          <span className="font-bold text-slate-700 dark:text-slate-200">
            {company.onTime}%
          </span>
        </div>
        <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              company.onTime >= 95
                ? "bg-green-500"
                : company.onTime >= 90
                  ? "bg-primary-500"
                  : "bg-yellow-500"
            }`}
            style={{ width: `${company.onTime}%` }}
          />
        </div>
      </div>

      {/* CTA */}
      <Link
        href={`/company/${company.id}`}
        className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-primary-50 dark:hover:bg-primary-900/20 text-slate-700 dark:text-slate-200 hover:text-primary-700 dark:hover:text-primary-400 text-sm font-semibold rounded-xl transition-colors border border-slate-200 dark:border-slate-600 hover:border-primary-200 dark:hover:border-primary-800"
      >
        View Profile
        <ArrowRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  );
}

// ─── Modals ────────────────────────────────────────────────────────────────────

function ContactModal({ isOpen, onClose, carrier }: { isOpen: boolean, onClose: () => void, carrier: any }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700">
          <h3 className="font-bold text-slate-800 dark:text-white">Contact {carrier?.name}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Message</label>
            <textarea className="saas-input py-2 text-sm min-h-[120px]" placeholder="Hi, I saw your truck has space for cars..."></textarea>
          </div>
          <button onClick={onClose} className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white text-sm font-semibold rounded-xl transition-colors">
            Send Message
          </button>
        </div>
      </div>
    </div>
  );
}

function OfferModal({ isOpen, onClose, carrier }: { isOpen: boolean, onClose: () => void, carrier: any }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700">
          <h3 className="font-bold text-slate-800 dark:text-white">Make Offer to {carrier?.name}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Offer Amount (€)</label>
            <input type="number" className="saas-input py-2 text-sm" placeholder="e.g. 500" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Loading Date</label>
            <input type="date" className="saas-input py-2 text-sm" />
          </div>
          <button onClick={onClose} className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white text-sm font-semibold rounded-xl transition-colors">
            Submit Offer
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Tab 1: LTL Matching ───────────────────────────────────────────────────────

function TabMatching() {
  const router = useRouter();
  const shipmentsQ = useShipments();
  const capacitiesQ = useCapacities();
  const book = useBookShipment();

  const [view, setView] = useState<'shipments' | 'capacities'>('shipments');
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [minWeight, setMinWeight] = useState('');
  const [minPallets, setMinPallets] = useState('');
  const [cargoType, setCargoType] = useState('All Types');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [highRatingOnly, setHighRatingOnly] = useState(false);
  const [minShipments, setMinShipments] = useState(false);
  const [sortBy, setSortBy] = useState<'newest' | 'weight' | 'deadline'>('newest');
  const [carSpaces, setCarSpaces] = useState('');
  const [selectedContact, setSelectedContact] = useState<(typeof mockMatches)[0] | null>(null);
  const [selectedOffer, setSelectedOffer] = useState<(typeof mockMatches)[0] | null>(null);

  const filteredShipments = useMemo(() => {
    const items = shipmentsQ.data ?? [];
    const o = origin.trim().toLowerCase();
    const d = destination.trim().toLowerCase();
    const ct = cargoType === 'All Types' ? '' : cargoType.toLowerCase();
    const wMin = minWeight ? Number(minWeight) : 0;
    const pMin = minPallets ? Number(minPallets) : 0;
    const fromTs = dateFrom ? new Date(dateFrom).getTime() : 0;

    const filtered = items.filter((s) => {
      if (o && !s.pickup_address.toLowerCase().includes(o)) return false;
      if (d && !s.delivery_address.toLowerCase().includes(d)) return false;
      if (ct && !s.cargo_type.toLowerCase().includes(ct)) return false;
      if (wMin && s.cargo_weight_kg < wMin) return false;
      if (pMin && s.pallet_count < pMin) return false;
      if (fromTs && new Date(s.pickup_window_start).getTime() < fromTs) return false;
      return true;
    });

    const sorted = [...filtered];
    if (sortBy === 'weight') sorted.sort((a, b) => b.cargo_weight_kg - a.cargo_weight_kg);
    else if (sortBy === 'deadline') sorted.sort((a, b) =>
      new Date(a.delivery_deadline).getTime() - new Date(b.delivery_deadline).getTime());
    else sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return sorted;
  }, [shipmentsQ.data, origin, destination, dateFrom, minWeight, minPallets, cargoType, sortBy]);

  const filteredCapacities = useMemo(() => {
    const items = capacitiesQ.data ?? [];
    const o = origin.trim().toLowerCase();
    const d = destination.trim().toLowerCase();
    const wMin = minWeight ? Number(minWeight) : 0;
    const pMin = minPallets ? Number(minPallets) : 0;
    const fromTs = dateFrom ? new Date(dateFrom).getTime() : 0;

    const filtered = items.filter((c) => {
      if (o && !c.origin_address.toLowerCase().includes(o)) return false;
      if (d && !c.destination_address.toLowerCase().includes(d)) return false;
      if (wMin && c.available_weight_kg < wMin) return false;
      if (pMin && c.available_pallets < pMin) return false;
      if (fromTs && new Date(c.departure_time).getTime() < fromTs) return false;
      return true;
    });

    const sorted = [...filtered];
    if (sortBy === 'weight') sorted.sort((a, b) => b.available_weight_kg - a.available_weight_kg);
    else if (sortBy === 'deadline') sorted.sort((a, b) =>
      new Date(a.departure_time).getTime() - new Date(b.departure_time).getTime());
    else sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return sorted;
  }, [capacitiesQ.data, origin, destination, dateFrom, minWeight, minPallets, sortBy]);

  // Kept for type compatibility with existing modals (unused)
  const filteredMatches = mockMatches;
  void filteredMatches; void verifiedOnly; void highRatingOnly; void minShipments; void carSpaces;

  return (
    <div className="flex h-[calc(100vh-130px)] w-full">
      <ContactModal isOpen={!!selectedContact} onClose={() => setSelectedContact(null)} carrier={selectedContact?.carrier} />
      <OfferModal isOpen={!!selectedOffer} onClose={() => setSelectedOffer(null)} carrier={selectedOffer?.carrier} />
      {/* Left filters panel */}
      <div className="w-72 flex-shrink-0 bg-white dark:bg-slate-800 border-r border-gray-200 dark:border-slate-600 z-20 overflow-y-auto p-5 flex flex-col gap-5">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-500 dark:text-slate-400" />
          <h2 className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
            Filters
          </h2>
        </div>

        {/* View toggle */}
        <div className="flex bg-slate-100 dark:bg-slate-700 rounded-xl p-1 text-xs font-semibold">
          <button
            onClick={() => setView('shipments')}
            className={`flex-1 px-2 py-1.5 rounded-lg transition-colors ${view === 'shipments' ? 'bg-white dark:bg-slate-800 text-primary-700 dark:text-primary-300 shadow-sm' : 'text-slate-500'}`}
          >
            Shipments
          </button>
          <button
            onClick={() => setView('capacities')}
            className={`flex-1 px-2 py-1.5 rounded-lg transition-colors ${view === 'capacities' ? 'bg-white dark:bg-slate-800 text-primary-700 dark:text-primary-300 shadow-sm' : 'text-slate-500'}`}
          >
            Capacities
          </button>
        </div>

        {/* Origin */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
            Origin
          </label>
          <input
            type="text"
            className="saas-input py-2 text-sm"
            placeholder="City or Postal Code"
            value={origin}
            onChange={(e) => setOrigin(e.target.value)}
          />
        </div>

        {/* Destination */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
            Destination
          </label>
          <input
            type="text"
            className="saas-input py-2 text-sm"
            placeholder="City or Postal Code"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
          />
        </div>

        {/* Date */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
            Date from
          </label>
          <input type="date" className="saas-input py-2 text-sm" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>

        {/* Min weight / pallets */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Min Weight (kg)</label>
            <input type="number" className="saas-input py-2 text-sm" value={minWeight} onChange={(e) => setMinWeight(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Min Pallets</label>
            <input type="number" className="saas-input py-2 text-sm" value={minPallets} onChange={(e) => setMinPallets(e.target.value)} />
          </div>
        </div>

        {/* Sort */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Sort by</label>
          <select className="saas-input py-2 text-sm" value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}>
            <option value="newest">Newest first</option>
            <option value="weight">Heaviest first</option>
            <option value="deadline">Earliest deadline</option>
          </select>
        </div>

        {/* Cargo Type */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
            Cargo Type
          </label>
          <select 
            className="saas-input py-2 text-sm appearance-none bg-no-repeat"
            value={cargoType}
            onChange={(e) => setCargoType(e.target.value)}
            style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2364748b' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")", backgroundPosition: 'right 12px center' }}
          >
            <option value="All Types">All Types</option>
            <option value="General">General Freight</option>
            <option value="Vehicles/Cars">Vehicles / Cars</option>
            <option value="Refrigerated">Refrigerated</option>
            <option value="Pallets">Pallets</option>
          </select>
        </div>

        {/* Dynamic Cargo Fields */}
        {cargoType === "Vehicles/Cars" ? (
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
              Number of Cars
            </label>
            <input
              type="number"
              className="saas-input py-2 text-sm"
              placeholder="e.g. 2"
              value={carSpaces}
              onChange={(e) => setCarSpaces(e.target.value)}
            />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                Weight (kg)
              </label>
              <input
                type="number"
                className="saas-input py-2 text-sm"
                placeholder="e.g. 500"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                Pallets
              </label>
              <input
                type="number"
                className="saas-input py-2 text-sm"
                placeholder="e.g. 2"
              />
            </div>
          </div>
        )}

        {/* Trust Filters */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary-500" />
            <h3 className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
              Trust Filters
            </h3>
          </div>
          <div className="bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl p-4 flex flex-col gap-3">
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

        <button className="saas-button w-full">Apply Filters</button>

        {/* Ad block */}
        <div className="mt-auto bg-slate-100 dark:bg-slate-700/50 border border-dashed border-slate-300 dark:border-slate-600 h-36 flex items-center justify-center text-xs text-slate-400 dark:text-slate-500 italic rounded-xl px-4 text-center leading-relaxed">
          Upgrade to Subscriber
          <br />
          to remove advertisements
        </div>
      </div>

      {/* Center map */}
      <div className="flex-1 relative z-0 min-w-0">
        <MapProvider>
          <MapComponent />
        </MapProvider>

        {/* Floating results panel */}
        <div className="absolute bottom-6 right-6 w-96 max-h-[78vh] bg-white/95 dark:bg-slate-800/95 backdrop-blur-md rounded-2xl border border-gray-200 dark:border-slate-600 shadow-xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-slate-700 flex-shrink-0">
            <h3 className="font-bold text-slate-800 dark:text-white text-sm">
              {view === 'shipments' ? 'Open Shipments' : 'Available Capacity'}
            </h3>
            <span className="bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 text-xs font-bold px-2.5 py-0.5 rounded-full border border-primary-200 dark:border-primary-800">
              {view === 'shipments' ? filteredShipments.length : filteredCapacities.length} found
            </span>
          </div>

          {/* Cards */}
          <div className="flex flex-col gap-3 p-4 overflow-y-auto flex-1">
            {view === 'shipments' && shipmentsQ.isLoading && (
              <div className="text-center py-6 text-slate-500 text-sm">Loading shipments…</div>
            )}
            {view === 'shipments' && shipmentsQ.error && (
              <div className="text-center py-6 text-red-500 text-sm">Failed to load shipments.</div>
            )}
            {view === 'shipments' && !shipmentsQ.isLoading && filteredShipments.length === 0 && (
              <div className="text-center py-6 text-slate-500 dark:text-slate-400 text-sm">
                No shipments match these filters.
              </div>
            )}
            {view === 'shipments' && filteredShipments.map((s) => (
              <div
                key={s.id}
                onClick={() => router.push(`/shipments/${s.id}`)}
                className="bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 p-3 rounded-xl hover:bg-white dark:hover:bg-slate-700 cursor-pointer transition-colors"
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <p className="font-bold text-sm text-slate-800 dark:text-white leading-tight flex-1 min-w-0 truncate">
                    {s.pickup_address.split(',')[0]} → {s.delivery_address.split(',')[0]}
                  </p>
                  <StatusBadge status={s.status} />
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                  {s.cargo_weight_kg.toLocaleString()} kg · {s.cargo_volume_m3} m³ · {s.pallet_count} pal · {s.cargo_type || 'general'}
                </p>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">
                    Pickup {new Date(s.pickup_window_start).toLocaleDateString()}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      book.mutate({ shipmentId: s.id });
                    }}
                    disabled={book.isPending || s.status !== 'open'}
                    className="font-semibold text-primary-600 dark:text-primary-400 hover:underline disabled:opacity-50 disabled:no-underline"
                  >
                    Book →
                  </button>
                </div>
              </div>
            ))}

            {view === 'capacities' && capacitiesQ.isLoading && (
              <div className="text-center py-6 text-slate-500 text-sm">Loading capacities…</div>
            )}
            {view === 'capacities' && capacitiesQ.error && (
              <div className="text-center py-6 text-red-500 text-sm">Failed to load capacities.</div>
            )}
            {view === 'capacities' && !capacitiesQ.isLoading && filteredCapacities.length === 0 && (
              <div className="text-center py-6 text-slate-500 dark:text-slate-400 text-sm">
                No capacities match these filters.
              </div>
            )}
            {view === 'capacities' && filteredCapacities.map((c) => (
              <div
                key={c.id}
                onClick={() => router.push(`/capacities/${c.id}`)}
                className="bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 p-3 rounded-xl hover:bg-white dark:hover:bg-slate-700 cursor-pointer transition-colors"
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <p className="font-bold text-sm text-slate-800 dark:text-white leading-tight flex-1 min-w-0 truncate">
                    {c.origin_address.split(',')[0]} → {c.destination_address.split(',')[0]}
                  </p>
                  <StatusBadge status={c.status} />
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                  {c.available_weight_kg.toLocaleString()} kg free · {c.available_volume_m3} m³ · {c.available_pallets} pal
                </p>
                <p className="text-xs text-slate-500">
                  Departs {new Date(c.departure_time).toLocaleString()}
                </p>
              </div>
            ))}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 px-4 py-3 border-t border-gray-100 dark:border-slate-700 flex-shrink-0">
            <Link href="/post-shipment" className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white text-xs font-semibold rounded-lg transition-colors">
              <Plus className="w-3.5 h-3.5" />
              Post Shipment
            </Link>
            <Link href="/add-capacity" className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg transition-colors border border-slate-200 dark:border-slate-600">
              <Truck className="w-3.5 h-3.5" />
              Add Capacity
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Tab 2: Predictive Engine ──────────────────────────────────────────────────

function TabPredictive() {
  return (
    <div className="overflow-y-auto h-[calc(100vh-130px)]">
      <div className="p-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: truck list */}
          <div className="lg:col-span-2 flex flex-col gap-5">
            <div>
              <div className="flex items-center gap-3 mb-1 flex-wrap">
                <h2 className="text-xl font-bold text-slate-800 dark:text-white">
                  Predicted Empty Trucks
                </h2>
                <span className="inline-flex items-center gap-1.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-bold px-2.5 py-1 rounded-full border border-green-200 dark:border-green-800">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                  </span>
                  Live
                </span>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                The system monitors active routes and predicts when trucks will
                become available.
              </p>
            </div>

            <div className="flex flex-col gap-4">
              {mockPredictions.map((p) => (
                <PredictionCard key={p.id} prediction={p} />
              ))}
            </div>
          </div>

          {/* Right: system status */}
          <div className="lg:col-span-1 flex flex-col gap-4">
            <div className="saas-card">
              {/* Engine header */}
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
                  <Cpu className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-white text-sm">
                    Prediction Engine
                  </h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                    <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                      Active — monitoring 24 trucks
                    </span>
                  </div>
                </div>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-3 mb-5">
                {(
                  [
                    {
                      label: "Trucks Monitored",
                      value: "24",
                      Icon: Truck,
                      color: "text-blue-600 dark:text-blue-400",
                      bg: "bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-900/40",
                    },
                    {
                      label: "Predictions Today",
                      value: "7",
                      Icon: TrendingUp,
                      color: "text-purple-600 dark:text-purple-400",
                      bg: "bg-purple-50 dark:bg-purple-900/20 border-purple-100 dark:border-purple-900/40",
                    },
                    {
                      label: "Loads Suggested",
                      value: "3",
                      Icon: Package,
                      color: "text-amber-600 dark:text-amber-400",
                      bg: "bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-900/40",
                    },
                    {
                      label: "Accepted",
                      value: "2",
                      Icon: CheckCircle2,
                      color: "text-green-600 dark:text-green-400",
                      bg: "bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-900/40",
                    },
                  ] as const
                ).map(({ label, value, Icon, color, bg }) => (
                  <div
                    key={label}
                    className={`${bg} rounded-xl p-3 border flex flex-col gap-1`}
                  >
                    <Icon className={`w-4 h-4 ${color}`} />
                    <p className="text-xl font-black text-slate-800 dark:text-white leading-none">
                      {value}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                      {label}
                    </p>
                  </div>
                ))}
              </div>

              {/* Info box */}
              <div className="bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl p-4 mb-5">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-slate-400 dark:text-slate-500 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    Fleet telematics data + route progress is used to predict
                    empty locations. Connect{" "}
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      Samsara
                    </span>
                    ,{" "}
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      Geotab
                    </span>
                    , or{" "}
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      Webfleet
                    </span>{" "}
                    in Integrations for real-time accuracy.
                  </p>
                </div>
              </div>

              <Link
                href="/integrations"
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                <BarChart3 className="w-4 h-4" />
                Connect Telematics
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Tab 3: Smart Loading Optimizer ───────────────────────────────────────────

function TabOptimizer() {
  const [cargoItems, setCargoItems] = useState<CargoItem[]>(initialCargoItems);
  const [truckType, setTruckType] = useState("Mega Trailer 13.6m");
  const [maxWeight, setMaxWeight] = useState(24000);
  const [optimized, setOptimized] = useState(true);
  const [nextId, setNextId] = useState(4);

  const totalWeight = cargoItems.reduce((sum, item) => sum + item.weight, 0);
  const usedVolume = cargoItems.reduce(
    (sum, item) => sum + item.quantity * item.length * item.width * item.height,
    0,
  );
  const maxVolume = 92;
  const weightPct = Math.round((totalWeight / maxWeight) * 100);
  const volumePct = Math.round((usedVolume / maxVolume) * 100);

  function addItem() {
    setCargoItems((prev) => [
      ...prev,
      {
        id: nextId,
        description: "",
        quantity: 1,
        weight: 0,
        length: 1.0,
        width: 1.0,
        height: 1.0,
      },
    ]);
    setNextId((n) => n + 1);
  }

  function removeItem(id: number) {
    setCargoItems((prev) => prev.filter((i) => i.id !== id));
  }

  function updateItem(
    id: number,
    field: keyof CargoItem,
    value: string | number,
  ) {
    setCargoItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    );
  }

  const loadingBlocks = [
    {
      label: "Machine Parts",
      weight: "4,500 kg",
      widthPct: 38,
      leftPct: 2,
      colorClass:
        "bg-red-200 dark:bg-red-900/50 border border-red-300 dark:border-red-700",
      textClass: "text-red-800 dark:text-red-300",
    },
    {
      label: "Pallets - Electronics",
      weight: "3,200 kg",
      widthPct: 32,
      leftPct: 42,
      colorClass:
        "bg-blue-200 dark:bg-blue-900/50 border border-blue-300 dark:border-blue-700",
      textClass: "text-blue-800 dark:text-blue-300",
    },
    {
      label: "Boxes - Clothing",
      weight: "1,800 kg",
      widthPct: 24,
      leftPct: 75,
      colorClass:
        "bg-green-200 dark:bg-green-900/50 border border-green-300 dark:border-green-700",
      textClass: "text-green-800 dark:text-green-300",
    },
  ];

  return (
    <div className="overflow-y-auto h-[calc(100vh-130px)]">
      <div className="p-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: input form */}
          <div className="saas-card flex flex-col gap-5">
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-primary-600 dark:text-primary-400" />
              <h2 className="text-lg font-bold text-slate-800 dark:text-white">
                Cargo Input
              </h2>
            </div>

            {/* Truck type + max weight */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                  Truck Type
                </label>
                <select
                  value={truckType}
                  onChange={(e) => setTruckType(e.target.value)}
                  className="saas-input py-2 text-sm"
                >
                  <option>Mega Trailer 13.6m</option>
                  <option>Standard Tilt</option>
                  <option>Reefer</option>
                  <option>Jumbo</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                  Max Weight (kg)
                </label>
                <input
                  type="number"
                  value={maxWeight}
                  onChange={(e) => setMaxWeight(Number(e.target.value))}
                  className="saas-input py-2 text-sm"
                />
              </div>
            </div>

            {/* Cargo items */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                  Cargo Items
                </label>
                <span className="text-xs text-slate-400 dark:text-slate-500">
                  {cargoItems.length} item{cargoItems.length !== 1 ? "s" : ""}
                </span>
              </div>

              {/* Header row */}
              <div className="grid grid-cols-[1fr_48px_72px_52px_52px_52px_28px] gap-1.5 px-1">
                {["Description", "Qty", "Wt kg", "L m", "W m", "H m", ""].map(
                  (h) => (
                    <span
                      key={h}
                      className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider"
                    >
                      {h}
                    </span>
                  ),
                )}
              </div>

              <div className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1">
                {cargoItems.map((item) => (
                  <div
                    key={item.id}
                    className="grid grid-cols-[1fr_48px_72px_52px_52px_52px_28px] gap-1.5 items-center"
                  >
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) =>
                        updateItem(item.id, "description", e.target.value)
                      }
                      className="saas-input py-1.5 text-xs"
                      placeholder="Description"
                    />
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) =>
                        updateItem(item.id, "quantity", Number(e.target.value))
                      }
                      className="saas-input py-1.5 text-xs text-center"
                    />
                    <input
                      type="number"
                      value={item.weight}
                      onChange={(e) =>
                        updateItem(item.id, "weight", Number(e.target.value))
                      }
                      className="saas-input py-1.5 text-xs text-center"
                    />
                    <input
                      type="number"
                      value={item.length}
                      step="0.1"
                      onChange={(e) =>
                        updateItem(item.id, "length", Number(e.target.value))
                      }
                      className="saas-input py-1.5 text-xs text-center"
                    />
                    <input
                      type="number"
                      value={item.width}
                      step="0.1"
                      onChange={(e) =>
                        updateItem(item.id, "width", Number(e.target.value))
                      }
                      className="saas-input py-1.5 text-xs text-center"
                    />
                    <input
                      type="number"
                      value={item.height}
                      step="0.1"
                      onChange={(e) =>
                        updateItem(item.id, "height", Number(e.target.value))
                      }
                      className="saas-input py-1.5 text-xs text-center"
                    />
                    <button
                      onClick={() => removeItem(item.id)}
                      className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <button
                onClick={addItem}
                className="inline-flex items-center gap-1.5 px-3 py-2 border border-dashed border-slate-300 dark:border-slate-600 rounded-xl text-xs font-semibold text-slate-500 dark:text-slate-400 hover:border-primary-400 dark:hover:border-primary-600 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Item
              </button>
            </div>

            <button
              onClick={() => setOptimized(true)}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white font-semibold rounded-xl transition-colors mt-auto"
            >
              <BarChart3 className="w-4 h-4" />
              Calculate Loading Plan
            </button>
          </div>

          {/* Right: visual plan */}
          <div className="saas-card flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                <h2 className="text-lg font-bold text-slate-800 dark:text-white">
                  Loading Plan
                </h2>
              </div>
              {optimized && (
                <span className="inline-flex items-center gap-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-bold px-2.5 py-1 rounded-full border border-green-200 dark:border-green-800">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Optimized
                </span>
              )}
            </div>

            {/* Truck bed visual */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span className="font-medium">← Rear (unload first)</span>
                <span className="font-medium">Cab →</span>
              </div>
              <div className="relative w-full h-48 bg-gray-100 dark:bg-slate-700 rounded-xl border-2 border-gray-300 dark:border-slate-500 overflow-hidden">
                {/* Cab indicator */}
                <div className="absolute right-0 top-0 bottom-0 w-6 bg-slate-200 dark:bg-slate-600 border-l-2 border-gray-300 dark:border-slate-500 flex items-center justify-center">
                  <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 [writing-mode:vertical-rl] rotate-180">
                    CAB
                  </span>
                </div>
                {/* Loading blocks */}
                {loadingBlocks.map((block) => (
                  <div
                    key={block.label}
                    className={`absolute top-3 bottom-3 rounded-lg ${block.colorClass} flex flex-col items-center justify-center p-1 overflow-hidden`}
                    style={{
                      left: `${block.leftPct}%`,
                      width: `${block.widthPct}%`,
                    }}
                  >
                    <span
                      className={`text-[10px] font-bold ${block.textClass} text-center leading-tight`}
                    >
                      {block.label}
                    </span>
                    <span
                      className={`text-[9px] ${block.textClass} opacity-80 mt-0.5`}
                    >
                      {block.weight}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Summary stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3 border border-slate-100 dark:border-slate-600">
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                  Total Weight
                </p>
                <p className="font-bold text-slate-800 dark:text-white text-sm tabular-nums">
                  {totalWeight.toLocaleString()} kg
                  <span className="text-slate-400 dark:text-slate-500 font-normal">
                    {" "}
                    / {maxWeight.toLocaleString()} kg
                  </span>
                </p>
                <div className="h-1.5 bg-slate-200 dark:bg-slate-600 rounded-full mt-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${weightPct > 90 ? "bg-red-500" : weightPct > 70 ? "bg-amber-500" : "bg-primary-500"}`}
                    style={{ width: `${Math.min(weightPct, 100)}%` }}
                  />
                </div>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                  {weightPct}% capacity
                </p>
              </div>

              <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3 border border-slate-100 dark:border-slate-600">
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                  Used Volume
                </p>
                <p className="font-bold text-slate-800 dark:text-white text-sm tabular-nums">
                  {usedVolume.toFixed(1)} m³
                  <span className="text-slate-400 dark:text-slate-500 font-normal">
                    {" "}
                    / {maxVolume} m³
                  </span>
                </p>
                <div className="h-1.5 bg-slate-200 dark:bg-slate-600 rounded-full mt-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${volumePct > 90 ? "bg-red-500" : volumePct > 70 ? "bg-amber-500" : "bg-blue-500"}`}
                    style={{ width: `${Math.min(volumePct, 100)}%` }}
                  />
                </div>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                  {volumePct}% used
                </p>
              </div>
            </div>

            {/* Unloading sequence */}
            <div className="bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl p-3">
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-2">
                Unloading Sequence
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                {[
                  "Machine Parts",
                  "Pallets - Electronics",
                  "Boxes - Clothing",
                ].map((name, i, arr) => (
                  <div key={name} className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 text-[10px] font-black flex items-center justify-center border border-primary-200 dark:border-primary-800">
                        {i + 1}
                      </span>
                      <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
                        {name}
                      </span>
                    </div>
                    {i < arr.length - 1 && (
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                    )}
                  </div>
                ))}
              </div>
            </div>

            <button className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-semibold text-sm rounded-xl transition-colors border border-slate-200 dark:border-slate-600 mt-auto">
              <BarChart3 className="w-4 h-4" />
              Export Loading Plan
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Tab 4: Companies ──────────────────────────────────────────────────────────

function TabCompanies() {
  const [search, setSearch] = useState("");

  const filtered = mockCompanies.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.country.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="overflow-y-auto h-[calc(100vh-130px)]">
      <div className="p-6 max-w-7xl mx-auto">
        {/* Page header */}
        <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
          <div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-white">
              Company Profiles
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              {filtered.length} carrier{filtered.length !== 1 ? "s" : ""} found
            </p>
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search company..."
              className="saas-input pl-9 pr-4 py-2 text-sm w-64"
            />
          </div>
        </div>

        {filtered.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filtered.map((company) => (
              <CompanyCard key={company.id} company={company} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Building2 className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-3" />
            <p className="font-semibold text-slate-600 dark:text-slate-400">
              No companies found
            </p>
            <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
              Try a different search term
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tab bar config ────────────────────────────────────────────────────────────

const TABS: { id: TabId; label: string; Icon: React.ElementType }[] = [
  { id: "matching", label: "LTL Matching", Icon: Map },
  { id: "predictive", label: "Predictive Engine", Icon: Cpu },
  { id: "optimizer", label: "Loading Optimizer", Icon: Package },
  { id: "companies", label: "Companies", Icon: Building2 },
];

// ─── Page root ─────────────────────────────────────────────────────────────────

export default function MarketplacePage() {
  const [activeTab, setActiveTab] = useState<TabId>("matching");

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] w-full overflow-hidden">
      {/* Page title bar */}
      <div className="flex-shrink-0 px-6 pt-5 pb-0 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700">
        <h1 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight mb-4">
          Marketplace Intelligence
        </h1>

        {/* Tab bar */}
        <nav
          className="flex items-end gap-1 -mb-px"
          aria-label="Marketplace tabs"
        >
          {TABS.map(({ id, label, Icon }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`
                  inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap
                  ${
                    isActive
                      ? "border-primary-600 text-primary-600 dark:text-primary-400 dark:border-primary-400"
                      : "border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 hover:border-gray-300 dark:hover:border-slate-500"
                  }
                `}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0">
        {activeTab === "matching" && <TabMatching />}
        {activeTab === "predictive" && <TabPredictive />}
        {activeTab === "optimizer" && <TabOptimizer />}
        {activeTab === "companies" && <TabCompanies />}
      </div>
    </div>
  );
}
