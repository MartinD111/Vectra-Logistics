"use client";

import { useState } from "react";
import {
  Navigation2,
  BookOpen,
  Radio,
  ClipboardCheck,
  Plus,
  CheckCircle2,
  AlertCircle,
  Anchor,
  Box,
  Building2,
  Plane,
  Square,
  MapPin,
  ArrowRight,
  Map,
  XCircle,
  Clock,
  Truck,
  ChevronRight,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type TabId = "library" | "record" | "review";
type DestType = "port" | "industrial" | "terminal" | "warehouse" | "airport";

// ─── Constants ────────────────────────────────────────────────────────────────

const DEST_TYPES: { id: DestType; label: string; icon: React.ElementType }[] = [
  { id: "port", label: "Port", icon: Anchor },
  { id: "industrial", label: "Industrial", icon: Box },
  { id: "terminal", label: "Terminal", icon: Square },
  { id: "warehouse", label: "Warehouse", icon: Building2 },
  { id: "airport", label: "Airport", icon: Plane },
];

const ROUTES = [
  {
    id: 1,
    name: "Port of Hamburg – Gate 7 Access",
    type: "Port",
    dist: "47 km",
    driver: "H. Mueller",
    status: "Approved",
  },
  {
    id: 2,
    name: "BMW Leipzig Terminal – Truck Entry",
    type: "Industrial",
    dist: "12 km",
    driver: "K. Schmidt",
    status: "Approved",
  },
  {
    id: 3,
    name: "Rotterdam Port – Container Dock B",
    type: "Port",
    dist: "63 km",
    driver: "P. Kowalski",
    status: "Approved",
  },
  {
    id: 4,
    name: "Amazon Warehouse Poznan",
    type: "Warehouse",
    dist: "8 km",
    driver: "M. Nowak",
    status: "Pending",
  },
  {
    id: 5,
    name: "Volkswagen Wolfsburg – Supplier Gate",
    type: "Industrial",
    dist: "15 km",
    driver: "T. Weber",
    status: "Approved",
  },
  {
    id: 6,
    name: "Milan Segrate Logistics Hub",
    type: "Warehouse",
    dist: "22 km",
    driver: "G. Rossi",
    status: "Pending",
  },
  {
    id: 7,
    name: "Frankfurt Airport Cargo Terminal",
    type: "Airport",
    dist: "31 km",
    driver: "A. Fischer",
    status: "Approved",
  },
  {
    id: 8,
    name: "Vienna Schwechat Industrial Park",
    type: "Industrial",
    dist: "19 km",
    driver: "F. Bauer",
    status: "Rejected",
  },
];

// ─── Shared Components ────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    Approved:
      "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    Pending:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    Rejected:
      "bg-red-100   text-red-700   dark:bg-red-900/30   dark:text-red-400",
  };
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${map[status] ?? ""}`}
    >
      {status}
    </span>
  );
}

// ─── TAB 1 — Route Library ────────────────────────────────────────────────────

function RouteLibrary() {
  const stats = [
    {
      label: "Saved Routes",
      value: 47,
      color: "text-primary-600 dark:text-primary-400",
      bg: "bg-primary-50 dark:bg-primary-900/20",
    },
    {
      label: "Approved",
      value: 38,
      color: "text-green-600 dark:text-green-400",
      bg: "bg-green-50 dark:bg-green-900/20",
    },
    {
      label: "Pending Review",
      value: 6,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-50 dark:bg-amber-900/20",
    },
    {
      label: "Shared with Fleet",
      value: 31,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-50 dark:bg-blue-900/20",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="bg-white dark:bg-dark-card rounded-2xl border border-gray-100 dark:border-dark-border p-5 shadow-sm flex items-center gap-4"
          >
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${s.bg}`}
            >
              <span className={`text-2xl font-black ${s.color}`}>
                {s.value}
              </span>
            </div>
            <p className="text-sm font-semibold text-gray-600 dark:text-gray-400 leading-tight">
              {s.label}
            </p>
          </div>
        ))}
      </div>

      {/* Routes table */}
      <div className="bg-white dark:bg-dark-card rounded-2xl border border-gray-100 dark:border-dark-border overflow-hidden shadow-sm">
        <div className="p-5 border-b border-gray-100 dark:border-dark-border flex items-center justify-between">
          <h3 className="text-lg font-black text-gray-900 dark:text-white">
            Saved Routes
          </h3>
          <button className="flex items-center gap-2 bg-primary-600 hover:bg-primary-500 text-white px-4 py-2 rounded-xl text-sm font-bold transition shadow-sm">
            <Plus className="w-4 h-4" /> Add Route
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[700px]">
            <thead>
              <tr className="bg-gray-50 dark:bg-slate-800/50 border-b border-gray-100 dark:border-dark-border text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 font-bold">
                <th className="p-4 pl-6">Route Name</th>
                <th className="p-4">Type</th>
                <th className="p-4">Distance</th>
                <th className="p-4">Recorded By</th>
                <th className="p-4">Status</th>
                <th className="p-4">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-dark-border">
              {ROUTES.map((r) => (
                <tr
                  key={r.id}
                  className="hover:bg-gray-50/50 dark:hover:bg-slate-800/30 transition-colors group"
                >
                  <td className="p-4 pl-6">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <span className="font-semibold text-sm text-gray-900 dark:text-white">
                        {r.name}
                      </span>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-slate-800 px-2.5 py-1 rounded-md border border-gray-200 dark:border-slate-700">
                      {r.type}
                    </span>
                  </td>
                  <td className="p-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                    {r.dist}
                  </td>
                  <td className="p-4 text-sm text-gray-500 dark:text-gray-400">
                    {r.driver}
                  </td>
                  <td className="p-4">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="p-4">
                    <button className="text-xs font-bold text-primary-600 dark:text-primary-400 hover:underline opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                      {r.status === "Pending"
                        ? "Review"
                        : r.status === "Rejected"
                          ? "Edit"
                          : "View"}
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Info banner */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-2xl p-4 flex items-start gap-3">
        <Navigation2 className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-blue-800 dark:text-blue-300 font-medium leading-relaxed">
          Routes capture the <strong>last ~50 km of approach</strong> to complex
          destinations — highway exits, turning points, and access roads are
          recorded automatically and shared with all fleet drivers going to that
          destination.
        </p>
      </div>
    </div>
  );
}

// ─── TAB 2 — Record Route ─────────────────────────────────────────────────────

function RecordRoute({
  isRecording,
  setIsRecording,
}: {
  isRecording: boolean;
  setIsRecording: (v: boolean) => void;
}) {
  const [destType, setDestType] = useState<DestType>("port");
  const [distance, setDistance] = useState(50);

  const HOW_IT_WORKS = [
    {
      step: 1,
      text: "Activate recording ~50 km before approaching a complex destination — port, terminal, or industrial zone.",
    },
    {
      step: 2,
      text: "VECTRA continuously captures GPS waypoints, highway exits, turning points, and access road details.",
    },
    {
      step: 3,
      text: "When you arrive, route data is automatically sent to your dispatcher for review and approval.",
    },
    {
      step: 4,
      text: "Approved routes are shared with all fleet drivers navigating to that same destination.",
    },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* ── Left column: recording panel ── */}
      <div className="lg:col-span-2 saas-card space-y-8">
        <div>
          <h2 className="text-xl font-black text-gray-900 dark:text-white mb-1">
            Activate Route Recording
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Configure recording settings and start capturing the approach route.
          </p>
        </div>

        {/* Step 1 — Destination type */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <span className="w-6 h-6 rounded-full bg-primary-600 text-white text-xs font-black flex items-center justify-center flex-shrink-0">
              1
            </span>
            <span className="font-bold text-sm text-gray-900 dark:text-white uppercase tracking-wide">
              Select Destination Type
            </span>
          </div>
          <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
            {DEST_TYPES.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setDestType(id)}
                className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all text-center
                  ${
                    destType === id
                      ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300"
                      : "border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-slate-600 bg-white dark:bg-slate-800"
                  }`}
              >
                <Icon
                  className={`w-6 h-6 ${
                    destType === id
                      ? "text-primary-600 dark:text-primary-400"
                      : "text-gray-400"
                  }`}
                />
                <span className="text-xs font-bold leading-tight">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Step 2 — Recording distance */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <span className="w-6 h-6 rounded-full bg-primary-600 text-white text-xs font-black flex items-center justify-center flex-shrink-0">
              2
            </span>
            <span className="font-bold text-sm text-gray-900 dark:text-white uppercase tracking-wide">
              Recording Distance
            </span>
          </div>
          <div className="flex flex-wrap gap-3">
            {[20, 35, 50, 75].map((km) => (
              <button
                key={km}
                onClick={() => setDistance(km)}
                className={`px-5 py-2.5 rounded-xl text-sm font-bold border-2 transition-all
                  ${
                    distance === km
                      ? "bg-primary-600 border-primary-600 text-white shadow-sm"
                      : "bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-slate-600"
                  }`}
              >
                {km} km
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            Recording activates automatically when your truck is within{" "}
            <strong>{distance} km</strong> of the destination.
          </p>
        </div>

        {/* Step 3 — Start / Stop */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <span className="w-6 h-6 rounded-full bg-primary-600 text-white text-xs font-black flex items-center justify-center flex-shrink-0">
              3
            </span>
            <span className="font-bold text-sm text-gray-900 dark:text-white uppercase tracking-wide">
              Start Recording
            </span>
          </div>

          <button
            onClick={() => setIsRecording(!isRecording)}
            className={`w-full flex items-center justify-center gap-3 py-4 rounded-2xl text-lg font-black transition-all shadow-md hover:shadow-lg active:scale-[0.98]
              ${
                isRecording
                  ? "bg-red-600 hover:bg-red-500 text-white"
                  : "bg-primary-600 hover:bg-primary-500 text-white"
              }`}
          >
            {isRecording ? (
              <>
                <Square className="w-5 h-5" /> Stop Recording
              </>
            ) : (
              <>
                <Navigation2 className="w-5 h-5" /> Start Recording
              </>
            )}
          </button>

          {isRecording && (
            <div className="mt-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3 flex-shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
                </span>
                <span className="font-bold text-green-800 dark:text-green-300">
                  Recording active — 12.4 km captured
                </span>
              </div>
              <p className="text-sm text-green-700 dark:text-green-400 font-medium pl-5">
                Currently on: <strong>A8 motorway</strong>, approaching
                Stuttgart junction
              </p>
              <div className="pl-5">
                <div className="w-full bg-green-200 dark:bg-green-900/50 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-green-500 h-2 rounded-full animate-pulse"
                    style={{ width: "25%" }}
                  />
                </div>
                <p className="text-xs text-green-600 dark:text-green-500 font-semibold mt-1">
                  23 waypoints captured · 37.6 km remaining
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Right column: How it works ── */}
      <div className="lg:col-span-1 bg-slate-900 dark:bg-slate-950 rounded-2xl p-6 text-white flex flex-col gap-6">
        <div>
          <h3 className="text-lg font-black mb-1">How It Works</h3>
          <p className="text-sm text-slate-400">
            Route recording is simple and automatic.
          </p>
        </div>

        <div className="space-y-5">
          {HOW_IT_WORKS.map(({ step, text }) => (
            <div key={step} className="flex items-start gap-3">
              <span className="w-7 h-7 rounded-full bg-primary-600 text-white text-xs font-black flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">
                {step}
              </span>
              <p className="text-sm text-slate-300 leading-relaxed">{text}</p>
            </div>
          ))}
        </div>

        <div className="bg-white/10 rounded-xl p-4 mt-auto">
          <div className="flex items-center gap-2 mb-2">
            <Map className="w-4 h-4 text-primary-400 flex-shrink-0" />
            <span className="text-sm font-bold">Google Maps Integration</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Approved routes automatically inject waypoints into driver
            navigation, providing turn-by-turn instructions for the final
            approach to complex destinations.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── TAB 3 — Dispatcher Review ────────────────────────────────────────────────

type ReviewState = "pending" | "approved" | "rejected";

interface ReviewCardProps {
  title: string;
  type: string;
  ago: string;
  driver: string;
  stats: [string, string][];
  points: [string, string][];
  state: ReviewState;
  onApprove: () => void;
  onReject: () => void;
}

function ReviewCard({
  title,
  type,
  ago,
  driver,
  stats,
  points,
  state,
  onApprove,
  onReject,
}: ReviewCardProps) {
  if (state === "approved") {
    return (
      <div className="saas-card border-l-4 border-green-500 bg-green-50/50 dark:bg-green-900/10">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400 flex-shrink-0" />
          <div>
            <p className="font-bold text-gray-900 dark:text-white">{title}</p>
            <p className="text-sm text-green-700 dark:text-green-400 font-semibold mt-0.5">
              Route approved and shared with fleet.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (state === "rejected") {
    return (
      <div className="saas-card border-l-4 border-red-500 bg-red-50/50 dark:bg-red-900/10">
        <div className="flex items-center gap-3">
          <XCircle className="w-6 h-6 text-red-600 dark:text-red-400 flex-shrink-0" />
          <div>
            <p className="font-bold text-gray-900 dark:text-white">{title}</p>
            <p className="text-sm text-red-700 dark:text-red-400 font-semibold mt-0.5">
              Route rejected and returned to driver for correction.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="saas-card">
      {/* Card header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <h3 className="text-lg font-black text-gray-900 dark:text-white mb-1">
            {title}
          </h3>
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-gray-500 dark:text-gray-400">
            <span className="bg-gray-100 dark:bg-slate-800 px-2.5 py-1 rounded-md border border-gray-200 dark:border-slate-700">
              {type}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" /> {ago}
            </span>
            <span>
              Recorded by:{" "}
              <strong className="text-gray-800 dark:text-gray-200">
                {driver}
              </strong>
            </span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {stats.map(([label, value]) => (
          <div
            key={label}
            className="bg-gray-50 dark:bg-slate-800 rounded-xl p-3 text-center border border-gray-100 dark:border-slate-700"
          >
            <p className="text-base font-black text-gray-900 dark:text-white">
              {value}
            </p>
            <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mt-0.5">
              {label}
            </p>
          </div>
        ))}
      </div>

      {/* Key route points */}
      <div className="bg-gray-50 dark:bg-slate-800/60 rounded-xl p-4 mb-5 space-y-2">
        <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
          Key Route Points
        </p>
        {points.map(([label, value]) => (
          <div key={label} className="flex items-center gap-2 text-sm">
            <ChevronRight className="w-3.5 h-3.5 text-primary-500 flex-shrink-0" />
            <span className="font-semibold text-gray-500 dark:text-gray-400 w-28 flex-shrink-0">
              {label}:
            </span>
            <span className="font-bold text-gray-900 dark:text-white">
              {value}
            </span>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={onApprove}
          className="flex items-center gap-2 bg-primary-600 hover:bg-primary-500 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition shadow-sm"
        >
          <CheckCircle2 className="w-4 h-4" /> Approve Route
        </button>
        <button className="flex items-center gap-2 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800 px-5 py-2.5 rounded-xl font-bold text-sm transition">
          <AlertCircle className="w-4 h-4" /> Request Edit
        </button>
        <button
          onClick={onReject}
          className="flex items-center gap-2 border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 px-5 py-2.5 rounded-xl font-bold text-sm transition"
        >
          <XCircle className="w-4 h-4" /> Reject
        </button>
      </div>
    </div>
  );
}

function DispatcherReview() {
  const [c1, setC1] = useState<ReviewState>("pending");
  const [c2, setC2] = useState<ReviewState>("pending");

  return (
    <div className="space-y-8">
      {/* Section header */}
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-black text-gray-900 dark:text-white">
          Routes Pending Review
        </h2>
        <span className="bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 text-xs font-black px-2.5 py-1 rounded-full border border-amber-200 dark:border-amber-800">
          2 pending
        </span>
      </div>

      {/* Review cards */}
      <div className="space-y-6">
        <ReviewCard
          title="Amazon Warehouse Poznan"
          type="Warehouse"
          ago="Recorded 2 days ago"
          driver="M. Nowak"
          stats={[
            ["Distance", "8.4 km"],
            ["Waypoints", "23"],
            ["Duration", "14 min"],
          ]}
          points={[
            ["Highway exit", "A2 Junction 134"],
            ["Access road", "ul. Logistyczna"],
            ["Gate", "North Entrance"],
          ]}
          state={c1}
          onApprove={() => setC1("approved")}
          onReject={() => setC1("rejected")}
        />
        <ReviewCard
          title="Milan Segrate Logistics Hub"
          type="Warehouse"
          ago="Recorded 5 days ago"
          driver="G. Rossi"
          stats={[
            ["Distance", "22.1 km"],
            ["Waypoints", "41"],
            ["Duration", "31 min"],
          ]}
          points={[
            ["Highway exit", "A1 Lodi exit"],
            ["Access road", "Via Rivoltana"],
            ["Gate", "West Loading Bay"],
          ]}
          state={c2}
          onApprove={() => setC2("approved")}
          onReject={() => setC2("rejected")}
        />
      </div>

      {/* Recently approved */}
      <div className="bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-900 rounded-2xl p-5">
        <h3 className="text-sm font-bold text-green-800 dark:text-green-300 uppercase tracking-wide mb-4 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> Recently Approved (last 7 days)
        </h3>
        <ul className="space-y-2.5">
          {[
            ["Port of Hamburg – Gate 7 Access", "H. Mueller"],
            ["BMW Leipzig Terminal – Truck Entry", "K. Schmidt"],
            ["Frankfurt Airport Cargo Terminal", "A. Fischer"],
          ].map(([name, driver]) => (
            <li key={name} className="flex items-center gap-3 text-sm">
              <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
              <span className="font-semibold text-gray-900 dark:text-white">
                {name}
              </span>
              <span className="text-gray-500 dark:text-gray-400 text-xs ml-auto flex-shrink-0">
                Driver {driver}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ─── ROOT PAGE ────────────────────────────────────────────────────────────────

export default function RoutesPage() {
  const [activeTab, setActiveTab] = useState<TabId>("library");
  const [isRecording, setIsRecording] = useState(false);

  const tabs: {
    id: TabId;
    label: string;
    icon: React.ElementType;
    badge?: string;
  }[] = [
    { id: "library", label: "Route Library", icon: BookOpen },
    { id: "record", label: "Record Route", icon: Radio },
    {
      id: "review",
      label: "Dispatcher Review",
      icon: ClipboardCheck,
      badge: "2",
    },
  ];

  return (
    <div className="min-h-[calc(100vh-64px)] bg-gray-50/50 dark:bg-dark-bg text-gray-900 dark:text-gray-100">
      <div className="max-w-7xl mx-auto px-4 lg:px-8 py-8">
        {/* ── Page header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-gray-900 dark:text-white flex items-center gap-3">
              <Navigation2 className="w-8 h-8 text-primary-600 dark:text-primary-400" />
              Vectra{" "}
              <span className="text-primary-600 dark:text-primary-400">
                Routes
              </span>
            </h1>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 max-w-2xl">
              Capture, improve, and share complex real-world truck routes to
              ports, terminals, warehouses, and industrial zones.
            </p>
          </div>

          {isRecording && (
            <div className="flex items-center gap-2 bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-800 px-4 py-2.5 rounded-full animate-fade-in flex-shrink-0">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
              </span>
              <span className="text-sm font-bold text-green-800 dark:text-green-300">
                Recording Active
              </span>
            </div>
          )}
        </div>

        {/* ── Sub-tab bar ── */}
        <div className="mb-8 border-b border-gray-200 dark:border-dark-border overflow-x-auto">
          <nav className="-mb-px flex space-x-1 min-w-max">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 border-b-2 text-sm font-semibold transition-colors whitespace-nowrap
                    ${
                      active
                        ? "border-primary-600 text-primary-600 dark:border-primary-400 dark:text-primary-400"
                        : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-slate-600"
                    }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                  {tab.badge && (
                    <span className="ml-1 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 text-xs font-black px-1.5 py-0.5 rounded-full">
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* ── Tab content ── */}
        <div key={activeTab} className="animate-fade-in">
          {activeTab === "library" && <RouteLibrary />}
          {activeTab === "record" && (
            <RecordRoute
              isRecording={isRecording}
              setIsRecording={setIsRecording}
            />
          )}
          {activeTab === "review" && <DispatcherReview />}
        </div>
      </div>
    </div>
  );
}
