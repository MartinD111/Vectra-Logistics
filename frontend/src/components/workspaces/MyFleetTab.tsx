"use client";

import { useState } from "react";
import {
  Truck,
  Navigation2,
  Ruler,
  ShieldCheck,
  Scale,
  AlertCircle,
  ClipboardList,
  Satellite,
  Plus,
  X,
  CheckCircle2,
  Wifi,
  WifiOff,
  Box,
} from "lucide-react";

// ─── Mock Data ────────────────────────────────────────────────────────────────

const fleetData = [
  {
    id: "T-101",
    type: "Mega Trailer",
    status: "Active",
    load: 85,
    length: "13.6m",
    height: "3.0m",
    width: "2.48m",
    maxWeight: "24t",
    volume: "92m³",
    location: "Berlin, DE",
    source: "Manual",
  },
  {
    id: "T-102",
    type: "Standard Tilt",
    status: "Idle",
    load: 0,
    length: "13.6m",
    height: "2.7m",
    width: "2.48m",
    maxWeight: "24t",
    volume: "82m³",
    location: "Warsaw, PL",
    source: "Manual",
  },
  {
    id: "T-103",
    type: "Reefer",
    status: "Active",
    load: 92,
    length: "13.6m",
    height: "2.6m",
    width: "2.48m",
    maxWeight: "22t",
    volume: "78m³",
    location: "Munich, DE",
    source: "Manual",
  },
  {
    id: "T-104",
    type: "Box Trailer",
    status: "Maintenance",
    load: 0,
    length: "13.6m",
    height: "2.7m",
    width: "2.48m",
    maxWeight: "22t",
    volume: "80m³",
    location: "Prague, CZ",
    source: "Manual",
  },
  {
    id: "T-105",
    type: "Jumbo",
    status: "Active",
    load: 45,
    length: "15.4m",
    height: "3.0m",
    width: "2.55m",
    maxWeight: "24t",
    volume: "105m³",
    location: "Paris, FR",
    source: "Manual",
  },
];

const trailerData = [
  {
    id: "TR-201",
    type: "Curtainsider",
    assignedTo: "T-101",
    status: "Attached",
  },
  {
    id: "TR-202",
    type: "Refrigerated",
    assignedTo: "T-103",
    status: "Attached",
  },
  { id: "TR-203", type: "Flatbed", assignedTo: "—", status: "Available" },
  { id: "TR-204", type: "Box", assignedTo: "—", status: "In Maintenance" },
];

const telematicsProviders = [
  { name: "Samsara", initials: "SA", color: "bg-blue-500" },
  { name: "Geotab", initials: "GT", color: "bg-indigo-500" },
  { name: "Webfleet", initials: "WF", color: "bg-orange-500" },
  { name: "Wialon", initials: "WN", color: "bg-teal-500" },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  icon,
  iconBg,
  value,
  label,
}: {
  icon: React.ReactNode;
  iconBg: string;
  value: string | number;
  label: string;
}) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-600 shadow-soft p-5 transition-all hover:shadow-lg">
      <div className="flex justify-between items-start mb-3">
        <div className={`p-2 rounded-lg ${iconBg}`}>{icon}</div>
      </div>
      <div className="text-2xl font-black text-gray-900 dark:text-white">
        {value}
      </div>
      <div className="text-sm font-semibold text-gray-500 dark:text-gray-400 mt-0.5">
        {label}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    Active:
      "bg-green-100  text-green-700  dark:bg-green-900/30  dark:text-green-400",
    Idle: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    Maintenance:
      "bg-red-100    text-red-700    dark:bg-red-900/30    dark:text-red-400",
  };
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${styles[status] ?? "bg-gray-100 text-gray-600"}`}
    >
      {status}
    </span>
  );
}

function TrailerStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    Attached:
      "bg-blue-100   text-blue-700   dark:bg-blue-900/30   dark:text-blue-400",
    Available:
      "bg-green-100  text-green-700  dark:bg-green-900/30  dark:text-green-400",
    "In Maintenance":
      "bg-red-100    text-red-700    dark:bg-red-900/30    dark:text-red-400",
  };
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${styles[status] ?? "bg-gray-100 text-gray-600"}`}
    >
      {status}
    </span>
  );
}

function SourceBadge({ source }: { source: string }) {
  if (source === "API Sync") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400">
        <span className="w-1.5 h-1.5 rounded-full bg-primary-500 animate-pulse" />
        API Sync
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-gray-400">
      Manual
    </span>
  );
}

function LoadBar({ load }: { load: number }) {
  const color =
    load > 80
      ? "bg-green-500"
      : load > 40
        ? "bg-yellow-500"
        : load === 0
          ? "bg-gray-300 dark:bg-slate-600"
          : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="w-24 bg-gray-200 dark:bg-slate-700 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all ${color}`}
          style={{ width: `${load}%` }}
        />
      </div>
      <span className="text-xs font-bold text-gray-600 dark:text-gray-400 w-8">
        {load}%
      </span>
    </div>
  );
}

// ─── API Integration Panel ────────────────────────────────────────────────────

function ApiIntegrationPanel() {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-600 shadow-soft p-6 transition-all hover:shadow-lg space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 rounded-xl">
            <Satellite className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-black text-gray-900 dark:text-white">
              Telematics Integration
            </h3>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
              Live data sync from your telematics provider
            </p>
          </div>
        </div>
        {/* Status Indicator */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100 dark:bg-slate-700 border border-gray-200 dark:border-slate-600">
          <WifiOff className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
          <span className="text-xs font-bold text-gray-500 dark:text-gray-400">
            Disconnected
          </span>
        </div>
      </div>

      {/* Connection Status Banner */}
      <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/15 border border-amber-200 dark:border-amber-700/40">
        <AlertCircle className="w-4.5 h-4.5 text-amber-500 flex-shrink-0" />
        <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
          No telematics provider connected
        </p>
      </div>

      {/* Supported Providers */}
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">
          Supported Providers
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {telematicsProviders.map((p) => (
            <div
              key={p.name}
              className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700/50 hover:border-primary-400 dark:hover:border-primary-500 hover:bg-primary-50/30 dark:hover:bg-primary-900/10 transition-all cursor-pointer group"
            >
              <div
                className={`w-8 h-8 rounded-lg ${p.color} flex items-center justify-center flex-shrink-0`}
              >
                <span className="text-xs font-black text-white">
                  {p.initials}
                </span>
              </div>
              <span className="text-sm font-bold text-gray-700 dark:text-gray-300 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                {p.name}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Connect Button */}
      <div className="flex items-center gap-4">
        <button className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-bold rounded-xl transition-colors shadow-sm hover:shadow-md">
          <Wifi className="w-4 h-4" />
          Connect Provider
        </button>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          OAuth 2.0 · TLS 1.3 encrypted
        </p>
      </div>

      {/* Info Note */}
      <p className="text-sm font-medium text-gray-500 dark:text-gray-400 leading-relaxed border-t border-gray-100 dark:border-slate-700 pt-5">
        Connect a telematics provider to automatically sync your fleet. Vehicle
        data, GPS location, and trip status will update in real-time.
      </p>

      {/* Sync Data Info Box */}
      <div className="rounded-xl bg-primary-50 dark:bg-primary-900/10 border border-primary-200 dark:border-primary-800/40 p-4">
        <p className="text-xs font-black uppercase tracking-wider text-primary-600 dark:text-primary-400 mb-3 flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Data that will sync automatically
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-6">
          {[
            {
              icon: <Truck className="w-3.5 h-3.5" />,
              label: "Truck ID & registration",
            },
            {
              icon: <Navigation2 className="w-3.5 h-3.5" />,
              label: "GPS location (real-time)",
            },
            {
              icon: <ShieldCheck className="w-3.5 h-3.5" />,
              label: "Speed & driving behaviour",
            },
            {
              icon: <CheckCircle2 className="w-3.5 h-3.5" />,
              label: "Trip status & route progress",
            },
            {
              icon: <Box className="w-3.5 h-3.5" />,
              label: "Driver status & HOS data",
            },
          ].map((item) => (
            <div
              key={item.label}
              className="flex items-center gap-2 text-xs font-semibold text-primary-700 dark:text-primary-300"
            >
              <span className="text-primary-500 dark:text-primary-400">
                {item.icon}
              </span>
              {item.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Add Vehicle Form ─────────────────────────────────────────────────────────

function AddVehicleForm({ onClose }: { onClose: () => void }) {
  const [formData, setFormData] = useState({
    vehicleId: "",
    vehicleType: "",
    maxWeight: "",
    volume: "",
    length: "",
    height: "",
    width: "",
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const inputClass =
    "w-full px-3 py-2 text-sm font-medium text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-slate-700/60 border border-gray-200 dark:border-slate-600 rounded-xl placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-400 transition-all";

  const labelClass =
    "block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5";

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-primary-200 dark:border-primary-700/50 shadow-soft p-6 transition-all">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 rounded-xl">
            <Plus className="w-4 h-4" />
          </div>
          <h3 className="text-base font-black text-gray-900 dark:text-white">
            Add New Vehicle
          </h3>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
          aria-label="Close form"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-5">
        {/* Row 1: ID + Type */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass} htmlFor="vehicleId">
              Vehicle ID / License Plate
            </label>
            <input
              id="vehicleId"
              name="vehicleId"
              type="text"
              placeholder="e.g. T-106 or AB-1234"
              value={formData.vehicleId}
              onChange={handleChange}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="vehicleType">
              Vehicle Type
            </label>
            <select
              id="vehicleType"
              name="vehicleType"
              value={formData.vehicleType}
              onChange={handleChange}
              className={inputClass}
            >
              <option value="" disabled>
                Select type…
              </option>
              <option value="Mega Trailer">Mega Trailer</option>
              <option value="Standard Tilt">Standard Tilt</option>
              <option value="Reefer">Reefer</option>
              <option value="Box Trailer">Box Trailer</option>
              <option value="Jumbo">Jumbo</option>
              <option value="Flatbed">Flatbed</option>
            </select>
          </div>
        </div>

        {/* Row 2: Max Weight + Volume */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass} htmlFor="maxWeight">
              Max Weight (kg)
            </label>
            <input
              id="maxWeight"
              name="maxWeight"
              type="number"
              placeholder="e.g. 24000"
              value={formData.maxWeight}
              onChange={handleChange}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="volume">
              Volume (m³)
            </label>
            <input
              id="volume"
              name="volume"
              type="number"
              placeholder="e.g. 92"
              value={formData.volume}
              onChange={handleChange}
              className={inputClass}
            />
          </div>
        </div>

        {/* Row 3: Dimensions */}
        <div>
          <label className={labelClass}>Dimensions</label>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <input
                name="length"
                type="number"
                placeholder="Length (m)"
                value={formData.length}
                onChange={handleChange}
                className={inputClass}
              />
            </div>
            <div>
              <input
                name="height"
                type="number"
                placeholder="Height (m)"
                value={formData.height}
                onChange={handleChange}
                className={inputClass}
              />
            </div>
            <div>
              <input
                name="width"
                type="number"
                placeholder="Width (m)"
                value={formData.width}
                onChange={handleChange}
                className={inputClass}
              />
            </div>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">
            Length · Height · Width in metres
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2 border-t border-gray-100 dark:border-slate-700">
          <button className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-bold rounded-xl transition-colors shadow-sm hover:shadow-md">
            <CheckCircle2 className="w-4 h-4" />
            Save Vehicle
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-bold text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 rounded-xl transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

type DataSource = "manual" | "api";

export default function MyFleetTab() {
  const [dataSource, setDataSource] = useState<DataSource>("manual");
  const [showAddForm, setShowAddForm] = useState(false);

  return (
    <div className="animate-fade-in space-y-8 pb-12">
      {/* ── Data Source Toggle ─────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-gray-900 dark:text-white">
            My Fleet
          </h2>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mt-0.5">
            Manage and monitor your vehicle assets
          </p>
        </div>

        <div className="inline-flex items-center p-1 bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl gap-1 self-start sm:self-auto">
          <button
            onClick={() => setDataSource("manual")}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
              dataSource === "manual"
                ? "bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm border border-gray-200 dark:border-slate-600"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            Manual Entry
          </button>
          <button
            onClick={() => setDataSource("api")}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
              dataSource === "api"
                ? "bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm border border-gray-200 dark:border-slate-600"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            <Satellite className="w-4 h-4" />
            API Integration
          </button>
        </div>
      </div>

      {/* ── API Integration Mode ───────────────────────────────────────────── */}
      {dataSource === "api" && <ApiIntegrationPanel />}

      {/* ── Overview Stats (always visible) ───────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Truck className="w-5 h-5" />}
          iconBg="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
          value={42}
          label="Total Assets"
        />
        <StatCard
          icon={<Navigation2 className="w-5 h-5" />}
          iconBg="bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400"
          value={35}
          label="Assets in Transit"
        />
        <StatCard
          icon={<Scale className="w-5 h-5" />}
          iconBg="bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400"
          value="78%"
          label="Avg Fleet Load Factor"
        />
        <StatCard
          icon={<AlertCircle className="w-5 h-5" />}
          iconBg="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400"
          value={3}
          label="Maintenance Required"
        />
      </div>

      {/* ── Fleet Table (Manual mode) ──────────────────────────────────────── */}
      {dataSource === "manual" && (
        <>
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-600 shadow-soft overflow-hidden transition-all hover:shadow-lg">
            {/* Table Header */}
            <div className="p-6 border-b border-gray-100 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h3 className="text-lg font-black text-gray-900 dark:text-white">
                  Fleet Database
                </h3>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Available for parsing in the Automation Tool
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400 self-start sm:self-auto">
                <Box className="w-3 h-3" />
                {fleetData.length} vehicles
              </span>
            </div>

            {/* Scrollable Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[900px]">
                <thead>
                  <tr className="bg-gray-50 dark:bg-slate-800/60 border-b border-gray-100 dark:border-slate-700 text-xs uppercase tracking-wider text-gray-400 dark:text-gray-500 font-black">
                    <th className="px-4 py-3">ID</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Current Load</th>
                    <th className="px-4 py-3">
                      <span className="flex items-center gap-1.5">
                        <Ruler className="w-3.5 h-3.5" />
                        Dimensions
                      </span>
                    </th>
                    <th className="px-4 py-3">
                      <span className="flex items-center gap-1.5">
                        <Scale className="w-3.5 h-3.5" />
                        Max Weight
                      </span>
                    </th>
                    <th className="px-4 py-3">
                      <span className="flex items-center gap-1.5">
                        <Box className="w-3.5 h-3.5" />
                        Volume
                      </span>
                    </th>
                    <th className="px-4 py-3">Location</th>
                    <th className="px-4 py-3">Data Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-700/60">
                  {fleetData.map((item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-gray-50/60 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* ID */}
                      <td className="px-4 py-3.5">
                        <span className="font-black text-sm text-gray-900 dark:text-white tracking-wide">
                          {item.id}
                        </span>
                      </td>

                      {/* Type */}
                      <td className="px-4 py-3.5 text-sm font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">
                        {item.type}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5">
                        <StatusBadge status={item.status} />
                      </td>

                      {/* Load */}
                      <td className="px-4 py-3.5">
                        <LoadBar load={item.load} />
                      </td>

                      {/* Dimensions */}
                      <td className="px-4 py-3.5">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                            <Ruler className="w-3 h-3 text-gray-400" />
                            {item.length} × {item.height} × {item.width}
                          </span>
                          <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500 pl-4">
                            L × H × W
                          </span>
                        </div>
                      </td>

                      {/* Max Weight */}
                      <td className="px-4 py-3.5">
                        <span className="flex items-center gap-1.5 text-sm font-bold text-gray-700 dark:text-gray-300">
                          <Scale className="w-3.5 h-3.5 text-gray-400" />
                          {item.maxWeight}
                        </span>
                      </td>

                      {/* Volume */}
                      <td className="px-4 py-3.5 text-sm font-bold text-gray-700 dark:text-gray-300">
                        {item.volume}
                      </td>

                      {/* Location */}
                      <td className="px-4 py-3.5">
                        <span className="flex items-center gap-1.5 text-sm font-semibold text-gray-600 dark:text-gray-400 whitespace-nowrap">
                          <Navigation2 className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                          {item.location}
                        </span>
                      </td>

                      {/* Data Source */}
                      <td className="px-4 py-3.5">
                        <SourceBadge source={item.source} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Add Vehicle Button / Form ──────────────────────────────────── */}
          {showAddForm ? (
            <AddVehicleForm onClose={() => setShowAddForm(false)} />
          ) : (
            <div className="flex justify-start">
              <button
                onClick={() => setShowAddForm(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white text-sm font-bold rounded-xl transition-all shadow-sm hover:shadow-md"
              >
                <Plus className="w-4 h-4" />
                Add Vehicle
              </button>
            </div>
          )}

          {/* ── Trailer Information ────────────────────────────────────────── */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-600 shadow-soft overflow-hidden transition-all hover:shadow-lg">
            <div className="p-6 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-gray-900 dark:text-white">
                  Trailers
                </h3>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Attached and available trailer units
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400">
                <Box className="w-3 h-3" />
                {trailerData.length} trailers
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[540px]">
                <thead>
                  <tr className="bg-gray-50 dark:bg-slate-800/60 border-b border-gray-100 dark:border-slate-700 text-xs uppercase tracking-wider text-gray-400 dark:text-gray-500 font-black">
                    <th className="px-4 py-3">Trailer ID</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Assigned Truck</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-700/60">
                  {trailerData.map((trailer) => (
                    <tr
                      key={trailer.id}
                      className="hover:bg-gray-50/60 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Trailer ID */}
                      <td className="px-4 py-3.5">
                        <span className="font-black text-sm text-gray-900 dark:text-white tracking-wide">
                          {trailer.id}
                        </span>
                      </td>

                      {/* Type */}
                      <td className="px-4 py-3.5 text-sm font-semibold text-gray-700 dark:text-gray-300">
                        {trailer.type}
                      </td>

                      {/* Assigned Truck */}
                      <td className="px-4 py-3.5">
                        {trailer.assignedTo === "—" ? (
                          <span className="text-sm text-gray-400 dark:text-gray-500 font-medium">
                            —
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-sm font-bold text-gray-700 dark:text-gray-300">
                            <Truck className="w-3.5 h-3.5 text-gray-400" />
                            {trailer.assignedTo}
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5">
                        <TrailerStatusBadge status={trailer.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
