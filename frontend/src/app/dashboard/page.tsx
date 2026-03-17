import Link from "next/link";
import {
  AlertCircle,
  Truck,
  Package,
  FileText,
  TrendingUp,
  CheckCircle2,
  Clock,
  ArrowRight,
  Zap,
  BarChart3,
  Navigation2,
} from "lucide-react";

export default function DashboardPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-8 py-8 animate-fade-in">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* ─────────────────────────────────────────────
            LEFT COLUMN
        ───────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-6">
          {/* ── Section 1 · Page Header ── */}
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Good morning, Driver 👋
            </h1>
            <p className="mt-1 text-slate-500 dark:text-slate-400 text-sm">
              Platform overview — today&apos;s snapshot
            </p>
          </div>

          {/* ── Section 2 · Smart Freight Alerts ── */}
          <section className="saas-card bg-primary-50/60 dark:bg-primary-900/10 border-primary-100 dark:border-primary-900/40">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                <h2 className="font-bold text-primary-800 dark:text-primary-300 text-base">
                  Smart Freight Alerts
                </h2>
              </div>
              {/* Live pulse badge */}
              <span className="flex items-center gap-1.5 bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 text-xs font-semibold px-2.5 py-1 rounded-full border border-primary-200 dark:border-primary-800">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-500 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-600" />
                </span>
                Live
              </span>
            </div>

            {/* Alert card */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-600 shadow-sm p-4">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-900 dark:text-white text-base">
                      Ljubljana → Munich
                    </span>
                    <span className="bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300 text-xs font-semibold px-2 py-0.5 rounded-md border border-primary-200 dark:border-primary-800">
                      Match: 85
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Pickup: Celje &nbsp;|&nbsp; Delivery: Salzburg &nbsp;|&nbsp;
                    Detour:&nbsp;
                    <span className="font-semibold text-amber-600 dark:text-amber-400">
                      +12.5 km
                    </span>
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-300 font-medium">
                    Cargo: 1,200 kg &nbsp;|&nbsp; Est. Revenue:&nbsp;
                    <span className="text-primary-600 dark:text-primary-400 font-bold">
                      +€150
                    </span>
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button className="px-4 py-2 text-sm font-semibold rounded-xl border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                    Ignore
                  </button>
                  <button className="px-4 py-2 text-sm font-semibold rounded-xl bg-primary-600 hover:bg-primary-700 text-white shadow-sm transition-colors">
                    Accept Load
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* ── Section 3 · Recent Shipments ── */}
          <section className="saas-card">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-slate-800 dark:text-white text-base flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                Recent Shipments
              </h2>
              <Link
                href="/marketplace"
                className="text-sm text-primary-600 dark:text-primary-400 hover:underline font-medium flex items-center gap-1"
              >
                View all <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                    <th className="pb-3 pr-4">Route</th>
                    <th className="pb-3 pr-4">Weight</th>
                    <th className="pb-3 pr-4">Status</th>
                    <th className="pb-3 text-right">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {/* Row 1 */}
                  <tr className="group">
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <Navigation2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="font-medium text-slate-800 dark:text-slate-100 whitespace-nowrap">
                          Warsaw → Berlin
                        </span>
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-slate-500 dark:text-slate-400">
                      2,400 kg
                    </td>
                    <td className="py-3 pr-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                        In Transit
                      </span>
                    </td>
                    <td className="py-3 text-right text-slate-400 dark:text-slate-500 whitespace-nowrap text-xs">
                      2h ago
                    </td>
                  </tr>
                  {/* Row 2 */}
                  <tr className="group">
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <Navigation2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="font-medium text-slate-800 dark:text-slate-100 whitespace-nowrap">
                          Munich → Milan
                        </span>
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-slate-500 dark:text-slate-400">
                      1,800 kg
                    </td>
                    <td className="py-3 pr-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        Matched
                      </span>
                    </td>
                    <td className="py-3 text-right text-slate-400 dark:text-slate-500 whitespace-nowrap text-xs">
                      5h ago
                    </td>
                  </tr>
                  {/* Row 3 */}
                  <tr className="group">
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <Navigation2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="font-medium text-slate-800 dark:text-slate-100 whitespace-nowrap">
                          Prague → Vienna
                        </span>
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-slate-500 dark:text-slate-400">
                      900 kg
                    </td>
                    <td className="py-3 pr-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                        Pending
                      </span>
                    </td>
                    <td className="py-3 text-right text-slate-400 dark:text-slate-500 whitespace-nowrap text-xs">
                      1d ago
                    </td>
                  </tr>
                  {/* Row 4 */}
                  <tr className="group">
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <Navigation2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="font-medium text-slate-800 dark:text-slate-100 whitespace-nowrap">
                          Paris → Brussels
                        </span>
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-slate-500 dark:text-slate-400">
                      3,200 kg
                    </td>
                    <td className="py-3 pr-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
                        Delivered
                      </span>
                    </td>
                    <td className="py-3 text-right text-slate-400 dark:text-slate-500 whitespace-nowrap text-xs">
                      2d ago
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* ── Section 4 · Recent Automations ── */}
          <section className="saas-card">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-slate-800 dark:text-white text-base flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-500" />
                Recent Automations
              </h2>
              <Link
                href="/automations"
                className="text-sm text-primary-600 dark:text-primary-400 hover:underline font-medium flex items-center gap-1"
              >
                View all <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="space-y-1">
              {/* Row 1 */}
              <div className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-slate-700 last:border-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm">
                      Auto CMR Generation
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3" /> 10 mins ago
                    </p>
                  </div>
                </div>
                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
              </div>

              {/* Row 2 */}
              <div className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-slate-700 last:border-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-violet-50 dark:bg-violet-900/30 flex items-center justify-center shrink-0">
                    <Truck className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm">
                      VIN List Cleaner
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3" /> 2h ago
                    </p>
                  </div>
                </div>
                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
              </div>

              {/* Row 3 */}
              <div className="flex items-center justify-between py-3 last:border-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-sky-50 dark:bg-sky-900/30 flex items-center justify-center shrink-0">
                    <BarChart3 className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm">
                      Weekly Fleet Report
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3" /> 3d ago
                    </p>
                  </div>
                </div>
                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
              </div>
            </div>
          </section>
        </div>

        {/* ─────────────────────────────────────────────
            RIGHT COLUMN
        ───────────────────────────────────────────── */}
        <div className="lg:col-span-1 space-y-6">
          {/* ── Section 1 · Quick Stat Cards (2×2) ── */}
          <div className="grid grid-cols-2 gap-4">
            {/* Active Trucks */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-600 shadow-sm p-4 flex flex-col gap-2">
              <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                <Truck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <p className="text-2xl font-extrabold text-slate-900 dark:text-white leading-none">
                24
              </p>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Active Trucks
              </p>
            </div>

            {/* Pending Loads */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-600 shadow-sm p-4 flex flex-col gap-2">
              <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center">
                <Package className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <p className="text-2xl font-extrabold text-slate-900 dark:text-white leading-none">
                7
              </p>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Pending Loads
              </p>
            </div>

            {/* Documents */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-600 shadow-sm p-4 flex flex-col gap-2">
              <div className="w-9 h-9 rounded-xl bg-violet-50 dark:bg-violet-900/30 flex items-center justify-center">
                <FileText className="w-5 h-5 text-violet-600 dark:text-violet-400" />
              </div>
              <p className="text-2xl font-extrabold text-slate-900 dark:text-white leading-none">
                134
              </p>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Documents
              </p>
            </div>

            {/* Fleet Load */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-600 shadow-sm p-4 flex flex-col gap-2">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <p className="text-2xl font-extrabold text-slate-900 dark:text-white leading-none">
                86%
              </p>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Fleet Load
              </p>
            </div>
          </div>

          {/* ── Section 2 · Fleet Status Gradient Card ── */}
          <div className="bg-gradient-to-br from-primary-600 to-emerald-700 rounded-2xl p-6 text-white shadow-lg">
            <div className="flex items-center gap-2 mb-1">
              <Truck className="w-5 h-5 text-white/80" />
              <h2 className="font-bold text-white text-base">Fleet Status</h2>
            </div>
            <p className="text-sm text-white/70 mb-5">Live from My Fleet</p>

            {/* Stat chips */}
            <div className="flex flex-wrap gap-2 mb-6">
              <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-sm rounded-xl px-3 py-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-300 inline-block" />
                <span className="text-xs font-semibold text-white">Active</span>
                <span className="text-xs font-extrabold text-white ml-1">
                  24
                </span>
              </div>
              <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-sm rounded-xl px-3 py-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-300 inline-block" />
                <span className="text-xs font-semibold text-white">Idle</span>
                <span className="text-xs font-extrabold text-white ml-1">
                  8
                </span>
              </div>
              <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-sm rounded-xl px-3 py-1.5">
                <span className="w-2 h-2 rounded-full bg-red-300 inline-block" />
                <span className="text-xs font-semibold text-white">Maint.</span>
                <span className="text-xs font-extrabold text-white ml-1">
                  3
                </span>
              </div>
            </div>

            <Link
              href="/fleet"
              className="inline-flex items-center gap-2 bg-white/20 hover:bg-white/30 transition-colors text-white text-sm font-semibold px-4 py-2 rounded-xl"
            >
              Open My Fleet <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* ── Section 3 · Recent Documents ── */}
          <section className="saas-card">
            <div className="flex items-center gap-2 mb-5">
              <FileText className="w-5 h-5 text-slate-400 dark:text-slate-500" />
              <h2 className="font-bold text-slate-800 dark:text-white text-base">
                Recent Documents
              </h2>
            </div>

            <div className="space-y-1">
              {/* Doc 1 */}
              <div className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-slate-700">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0">
                    <FileText className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
                      CMR-2891
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 truncate">
                      Ljubljana → Munich · 2h ago
                    </p>
                  </div>
                </div>
                <Link
                  href="/documents"
                  className="text-xs text-primary-600 dark:text-primary-400 hover:underline font-medium ml-2 shrink-0"
                >
                  View
                </Link>
              </div>

              {/* Doc 2 */}
              <div className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-slate-700">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0">
                    <FileText className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
                      CMR-2890
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 truncate">
                      Warsaw → Berlin · 5h ago
                    </p>
                  </div>
                </div>
                <Link
                  href="/documents"
                  className="text-xs text-primary-600 dark:text-primary-400 hover:underline font-medium ml-2 shrink-0"
                >
                  View
                </Link>
              </div>

              {/* Doc 3 */}
              <div className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0">
                    <FileText className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
                      Invoice #1204
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 truncate">
                      1d ago
                    </p>
                  </div>
                </div>
                <Link
                  href="/documents"
                  className="text-xs text-primary-600 dark:text-primary-400 hover:underline font-medium ml-2 shrink-0"
                >
                  View
                </Link>
              </div>
            </div>
          </section>
        </div>
        {/* end right column */}
      </div>
    </div>
  );
}
