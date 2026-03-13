'use client';

import { ShieldCheck, Package, TrendingUp, Clock, CreditCard, Zap, Star, CheckCircle2, MapPin, Truck, Users, MessageSquare } from 'lucide-react';

// ─── Mock Data ─────────────────────────────────────────────────────────────────
const company = {
  id: 1,
  name: 'TransEurope Logistics GmbH',
  country: 'Germany',
  countryFlag: '🇩🇪',
  initials: 'TE',
  isVerified: true,
  memberSince: 2021,
  yearsOnPlatform: 4,
  fleetSize: 48,
  stats: {
    totalShipments: 1284,
    successRate: 97.3,
    onTimeDelivery: 94.1,
    paymentReliability: 98.5,
    avgPaymentSpeed: 2.3,
    avgRating: 4.8,
    totalReviews: 347,
  },
  verification: {
    businessRegistration: true,
    vatNumber: 'DE123456789',
    transportLicense: 'EU-TL-2019-4821',
  },
};

const reviews = [
  {
    id: 1,
    author: 'Marcus H.',
    role: 'Shipper',
    rating: 5,
    text: 'Delivered on time despite difficult weather conditions. Excellent communication throughout.',
    date: '12 May 2025',
  },
  {
    id: 2,
    author: 'Anna K.',
    role: 'Shipper',
    rating: 5,
    text: 'Professional service, cargo arrived in perfect condition. Will use again.',
    date: '3 Apr 2025',
  },
  {
    id: 3,
    author: 'Peter V.',
    role: 'Shipper',
    rating: 4,
    text: 'Good communication but loading took longer than agreed.',
    date: '18 Mar 2025',
  },
];

const ratingBreakdown = {
  asCarrier: [
    { label: 'Delivery Punctuality', score: 4.9 },
    { label: 'Cargo Condition', score: 4.8 },
    { label: 'Communication', score: 4.7 },
  ],
  asShipper: [
    { label: 'Payment Speed', score: 4.9 },
    { label: 'Loading Conditions', score: 4.6 },
    { label: 'Shipment Accuracy', score: 4.8 },
  ],
};

// ─── Star Components ───────────────────────────────────────────────────────────

function StarFull({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="currentColor" className="text-yellow-400">
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.37 2.448a1 1 0 00-.364 1.118l1.286 3.957c.3.921-.755 1.688-1.54 1.118l-3.37-2.448a1 1 0 00-1.175 0l-3.37 2.448c-.784.57-1.838-.197-1.539-1.118l1.286-3.957a1 1 0 00-.364-1.118L2.063 9.384c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69L9.049 2.927z" />
    </svg>
  );
}

function StarEmpty({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} className="text-gray-300 dark:text-slate-600">
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.37 2.448a1 1 0 00-.364 1.118l1.286 3.957c.3.921-.755 1.688-1.54 1.118l-3.37-2.448a1 1 0 00-1.175 0l-3.37 2.448c-.784.57-1.838-.197-1.539-1.118l1.286-3.957a1 1 0 00-.364-1.118L2.063 9.384c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69L9.049 2.927z" />
    </svg>
  );
}

function StarPartial({ fill = 0.8, size = 20 }: { fill?: number; size?: number }) {
  const id = `partial-${Math.round(fill * 100)}`;
  return (
    <svg width={size} height={size} viewBox="0 0 20 20">
      <defs>
        <linearGradient id={id}>
          <stop offset={`${fill * 100}%`} stopColor="#facc15" />
          <stop offset={`${fill * 100}%`} stopColor="transparent" />
        </linearGradient>
      </defs>
      <path
        d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.37 2.448a1 1 0 00-.364 1.118l1.286 3.957c.3.921-.755 1.688-1.54 1.118l-3.37-2.448a1 1 0 00-1.175 0l-3.37 2.448c-.784.57-1.838-.197-1.539-1.118l1.286-3.957a1 1 0 00-.364-1.118L2.063 9.384c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69L9.049 2.927z"
        fill={`url(#${id})`}
        stroke="#facc15"
        strokeWidth={1}
      />
    </svg>
  );
}

function StarRow({ rating, size = 20 }: { rating: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => {
        const full = i + 1;
        if (rating >= full) return <StarFull key={i} size={size} />;
        if (rating >= full - 0.5) return <StarPartial key={i} fill={rating - (full - 1)} size={size} />;
        return <StarEmpty key={i} size={size} />;
      })}
    </div>
  );
}

// ─── Mini rating bar ──────────────────────────────────────────────────────────

function RatingBar({ label, score }: { label: string; score: number }) {
  const pct = (score / 5) * 100;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-600 dark:text-slate-300 font-medium">{label}</span>
        <span className="font-bold text-slate-800 dark:text-white tabular-nums">{score.toFixed(1)}</span>
      </div>
      <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-primary-500 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
  accent = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-600 p-5 flex flex-col gap-3 shadow-soft hover:shadow-md transition-all duration-200">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${accent ? 'bg-primary-100 dark:bg-primary-900/40' : 'bg-slate-100 dark:bg-slate-700'}`}>
        <span className={accent ? 'text-primary-600 dark:text-primary-400' : 'text-slate-500 dark:text-slate-300'}>
          {icon}
        </span>
      </div>
      <div>
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{label}</p>
        <p className={`text-2xl font-black mt-0.5 ${accent ? 'text-primary-600 dark:text-primary-400' : 'text-slate-900 dark:text-white'}`}>
          {value}
        </p>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CompanyPage({ params }: { params: { id: string } }) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pb-16 animate-fade-in">
      {/* ── Hero Header ───────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-600 shadow-soft">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">

            {/* Avatar */}
            <div className="relative flex-shrink-0">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-2xl font-black shadow-lg select-none">
                {company.initials}
              </div>
              {company.isVerified && (
                <div className="absolute -bottom-2 -right-2 bg-primary-500 text-white rounded-full p-1 shadow-md border-2 border-white dark:border-slate-800">
                  <ShieldCheck className="w-3.5 h-3.5" />
                </div>
              )}
            </div>

            {/* Name & meta */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                  {company.name}
                </h1>
                {company.isVerified && (
                  <span className="inline-flex items-center gap-1.5 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 border border-primary-200 dark:border-primary-800 text-sm font-bold px-3 py-1 rounded-full">
                    <ShieldCheck className="w-4 h-4" />
                    Verified Company
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4" />
                  {company.countryFlag} {company.country}
                </span>
                <span className="flex items-center gap-1.5">
                  <Truck className="w-4 h-4" />
                  <span className="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-600">
                    {company.fleetSize} vehicles
                  </span>
                </span>
                <span className="flex items-center gap-1.5">
                  <Users className="w-4 h-4" />
                  Active since {company.memberSince} · {company.yearsOnPlatform} years on VECTRA
                </span>
              </div>

              {/* Summary rating pill */}
              <div className="flex items-center gap-2 mt-3">
                <StarRow rating={company.stats.avgRating} size={18} />
                <span className="font-bold text-slate-800 dark:text-white text-sm">
                  {company.stats.avgRating.toFixed(1)}
                </span>
                <span className="text-slate-400 dark:text-slate-500 text-sm">
                  ({company.stats.totalReviews} reviews)
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Content ───────────────────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

        {/* ── Stats Grid ──────────────────────────────────────────────────── */}
        <section>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <Package className="w-5 h-5 text-primary-500" />
            Performance Overview
          </h2>

          {/* Row 1 – Operational */}
          <div className="mb-3">
            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">
              Operational Metrics
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatCard
                icon={<Package className="w-5 h-5" />}
                label="Total Shipments Completed"
                value={company.stats.totalShipments.toLocaleString()}
              />
              <StatCard
                icon={<TrendingUp className="w-5 h-5" />}
                label="Success Rate"
                value={`${company.stats.successRate}%`}
                accent
              />
              <StatCard
                icon={<Clock className="w-5 h-5" />}
                label="On-Time Delivery"
                value={`${company.stats.onTimeDelivery}%`}
              />
            </div>
          </div>

          {/* Row 2 – Financial */}
          <div className="mb-3">
            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">
              Financial Behaviour
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <StatCard
                icon={<CreditCard className="w-5 h-5" />}
                label="Payment Reliability"
                value={`${company.stats.paymentReliability}%`}
                accent
              />
              <StatCard
                icon={<Zap className="w-5 h-5" />}
                label="Avg Payment Speed"
                value={`${company.stats.avgPaymentSpeed} days`}
              />
            </div>
          </div>

          {/* Row 3 – Reputation */}
          <div>
            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">
              Reputation
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

              {/* Big rating card */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-600 p-6 flex flex-col gap-4 shadow-soft hover:shadow-md transition-all duration-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Average Rating</p>
                    <p className="text-5xl font-black text-slate-900 dark:text-white mt-1 tabular-nums">
                      {company.stats.avgRating.toFixed(1)}
                      <span className="text-xl font-semibold text-slate-400 dark:text-slate-500">/5</span>
                    </p>
                  </div>
                  <div className="w-14 h-14 rounded-2xl bg-yellow-50 dark:bg-yellow-900/20 flex items-center justify-center border border-yellow-200 dark:border-yellow-800">
                    <Star className="w-7 h-7 text-yellow-400 fill-yellow-400" />
                  </div>
                </div>
                <StarRow rating={company.stats.avgRating} size={24} />
              </div>

              <StatCard
                icon={<MessageSquare className="w-5 h-5" />}
                label="Total Reviews"
                value={`${company.stats.totalReviews.toLocaleString()} reviews`}
              />
            </div>
          </div>
        </section>

        {/* ── Verification ────────────────────────────────────────────────── */}
        <section>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary-500" />
            Verification Status
          </h2>
          <div className="saas-card">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

              <VerificationRow
                label="Business Registration"
                verified={company.verification.businessRegistration}
              />
              <VerificationRow
                label="VAT Number"
                verified={!!company.verification.vatNumber}
                detail={company.verification.vatNumber}
              />
              <VerificationRow
                label="Transport License"
                verified={!!company.verification.transportLicense}
                detail={company.verification.transportLicense}
              />
              <div className="flex items-start gap-3 py-2">
                <div className="w-8 h-8 rounded-xl bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0 border border-primary-200 dark:border-primary-800">
                  <Users className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">VECTRA Member Since</p>
                  <p className="font-bold text-slate-800 dark:text-white">{company.memberSince}</p>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* ── Rating Breakdown ─────────────────────────────────────────────── */}
        <section>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
            Rating Breakdown
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">

            {/* As a Carrier */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-600 p-6 shadow-soft hover:shadow-md transition-all duration-200">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center border border-blue-200 dark:border-blue-800">
                  <Truck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">As a Carrier</p>
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Rated by Shippers</p>
                </div>
              </div>
              <div className="flex flex-col gap-4">
                {ratingBreakdown.asCarrier.map((item) => (
                  <RatingBar key={item.label} label={item.label} score={item.score} />
                ))}
              </div>
            </div>

            {/* As a Shipper */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-600 p-6 shadow-soft hover:shadow-md transition-all duration-200">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center border border-purple-200 dark:border-purple-800">
                  <Package className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">As a Shipper</p>
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Rated by Carriers</p>
                </div>
              </div>
              <div className="flex flex-col gap-4">
                {ratingBreakdown.asShipper.map((item) => (
                  <RatingBar key={item.label} label={item.label} score={item.score} />
                ))}
              </div>
            </div>

          </div>
        </section>

        {/* ── Reviews ──────────────────────────────────────────────────────── */}
        <section>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary-500" />
            Recent Reviews
            <span className="ml-1 text-sm font-semibold text-slate-400 dark:text-slate-500">
              ({company.stats.totalReviews} total)
            </span>
          </h2>
          <div className="flex flex-col gap-4">
            {reviews.map((review) => (
              <ReviewCard key={review.id} review={review} />
            ))}
          </div>
        </section>

      </div>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function VerificationRow({
  label,
  verified,
  detail,
}: {
  label: string;
  verified: boolean;
  detail?: string;
}) {
  return (
    <div className="flex items-start gap-3 py-2">
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 border ${
        verified
          ? 'bg-primary-50 dark:bg-primary-900/30 border-primary-200 dark:border-primary-800'
          : 'bg-slate-100 dark:bg-slate-700 border-slate-200 dark:border-slate-600'
      }`}>
        <CheckCircle2 className={`w-4 h-4 ${verified ? 'text-primary-600 dark:text-primary-400' : 'text-slate-400'}`} />
      </div>
      <div>
        <div className="flex items-center gap-2">
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{label}</p>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
            verified
              ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300'
              : 'bg-slate-100 dark:bg-slate-700 text-slate-500'
          }`}>
            {verified ? '✅ Verified' : 'Pending'}
          </span>
        </div>
        {detail && (
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mt-0.5 font-mono tracking-wide">
            {detail}
          </p>
        )}
      </div>
    </div>
  );
}

function ReviewCard({
  review,
}: {
  review: { id: number; author: string; role: string; rating: number; text: string; date: string };
}) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-600 p-5 shadow-soft hover:shadow-md transition-all duration-200">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-300 to-slate-400 dark:from-slate-600 dark:to-slate-700 flex items-center justify-center text-white font-bold text-sm flex-shrink-0 select-none">
            {review.author[0]}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-bold text-sm text-slate-800 dark:text-white">{review.author}</p>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                review.role === 'Shipper'
                  ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                  : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
              }`}>
                {review.role}
              </span>
            </div>
            <StarRow rating={review.rating} size={14} />
          </div>
        </div>
        <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">{review.date}</span>
      </div>
      <p className="mt-3 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
        "{review.text}"
      </p>
    </div>
  );
}
